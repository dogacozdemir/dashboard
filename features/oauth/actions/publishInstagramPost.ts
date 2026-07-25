'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { requirePermission } from '@/lib/auth/permissions';
import { decryptToken, unpackToken } from '@/lib/utils/crypto';
import { createPresignedDownloadUrl } from '@/lib/storage/s3';
import { extractS3Key, normalizeDuplicateTenantKey } from '@/features/creative-studio/lib/creativeS3Keys';
import type { CreativeContentFormat } from '@/features/creative-studio/types';

const GRAPH_VERSION = 'v20.0';

export type PublishInstagramResult =
  | { success: true; instagramMediaId: string; published: boolean }
  | { success: false; error: string; errorKey?: string };

async function signMediaUrl(rawUrl: string | null): Promise<string | null> {
  if (!rawUrl) return null;
  const key = normalizeDuplicateTenantKey(extractS3Key(rawUrl));
  if (!key) return rawUrl;
  try {
    return await createPresignedDownloadUrl({ bucket: 'creative', key, expiresIn: 7200 });
  } catch {
    return rawUrl;
  }
}

function mapContentFormatToMediaType(
  format: CreativeContentFormat,
  slideCount: number,
  primaryType: string,
): 'IMAGE' | 'VIDEO' | 'CAROUSEL' {
  if (format === 'carousel' || slideCount > 1) return 'CAROUSEL';
  if (format === 'reel' || primaryType === 'video') return 'VIDEO';
  return 'IMAGE';
}

/**
 * A media container must reach `status_code = FINISHED` before `media_publish`.
 * Images finish instantly; video/reels/carousel need processing time, so publishing
 * immediately (as the old code did) fails with "Media ID is not available".
 * Bounded poll — heavy videos exceeding the window need a background job.
 */
async function waitForContainerReady(
  graphBase: string,
  containerId: string,
  accessToken: string,
  maxMs = 55_000,
  intervalMs = 3_000,
): Promise<{ ready: boolean; error?: string }> {
  const deadline = Date.now() + maxMs;
  for (;;) {
    const res = await fetch(
      `${graphBase}/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    if (res.ok) {
      const json = (await res.json()) as { status_code?: string };
      if (json.status_code === 'FINISHED') return { ready: true };
      if (json.status_code === 'ERROR' || json.status_code === 'EXPIRED') {
        return { ready: false, error: `Media processing ${json.status_code}` };
      }
    }
    if (Date.now() >= deadline) return { ready: false, error: 'Media processing timed out' };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Placeholder pipeline for Meta Content Publishing API.
 * Requires `meta_publishing_accounts` row + public media URLs for Graph API.
 *
 * Flow: POST /{ig-user-id}/media → POST /{ig-user-id}/media_publish
 */
export async function publishInstagramPost(
  companyId: string,
  creativePostId: string,
): Promise<PublishInstagramResult> {
  await requireTenantAction(companyId);
  await requirePermission('creative.approve');
  const supabase = await createSupabaseServerClient();
  return publishInstagramPostCore(supabase, companyId, creativePostId);
}

/**
 * Session-free publish. The scheduled publisher runs with the admin client and
 * has no session to satisfy `requireTenantAction`, so the guards live in the
 * wrapper above and the Graph work lives here.
 *
 * Records the outcome on the post — without that there is no way to tell what
 * shipped, and a retry would publish the same creative twice.
 */
export async function publishInstagramPostCore(
  supabase: SupabaseClient,
  companyId: string,
  creativePostId: string,
): Promise<PublishInstagramResult> {

  const { data: post, error: postErr } = await supabase
    .from('creative_posts')
    .select(
      `
      id, tenant_id, caption, platform, status, content_format,
      publish_state, published_at, ig_media_id, publish_attempts,
      creative_assets ( id, url, type, slide_index )
    `,
    )
    .eq('id', creativePostId)
    .eq('tenant_id', companyId)
    .single();

  if (postErr || !post) {
    return { success: false, error: 'Creative post not found.', errorKey: 'post_not_found' };
  }

  if (post.platform !== 'instagram') {
    return { success: false, error: 'Post platform is not Instagram.', errorKey: 'wrong_platform' };
  }

  if (post.status !== 'approved') {
    return { success: false, error: 'Only approved posts can be published.', errorKey: 'not_approved' };
  }

  // Publishing is irreversible — never let a retry double-post.
  if (post.publish_state === 'published' || post.ig_media_id) {
    return {
      success: false,
      error: 'This post has already been published to Instagram.',
      errorKey: 'already_published',
    };
  }

  // Claim the row so a cron run and a manual click can't both push it live.
  const { data: claimed, error: claimErr } = await supabase
    .from('creative_posts')
    .update({
      publish_state: 'publishing',
      publish_attempts: Number(post.publish_attempts ?? 0) + 1,
      publish_error: null,
    })
    .eq('id', creativePostId)
    .eq('tenant_id', companyId)
    .in('publish_state', ['idle', 'queued', 'failed'])
    .select('id')
    .maybeSingle();

  if (claimErr || !claimed) {
    return {
      success: false,
      error: 'Another publish attempt is already in progress.',
      errorKey: 'publish_in_progress',
    };
  }

  /** Every early return past this point must release the claim. */
  const fail = async (error: string, errorKey?: string): Promise<PublishInstagramResult> => {
    await supabase
      .from('creative_posts')
      .update({ publish_state: 'failed', publish_error: error.slice(0, 500) })
      .eq('id', creativePostId)
      .eq('tenant_id', companyId);
    return { success: false, error, errorKey };
  };

  const succeed = async (instagramMediaId: string): Promise<PublishInstagramResult> => {
    await supabase
      .from('creative_posts')
      .update({
        publish_state: 'published',
        published_at: new Date().toISOString(),
        ig_media_id: instagramMediaId,
        publish_error: null,
      })
      .eq('id', creativePostId)
      .eq('tenant_id', companyId);
    return { success: true, instagramMediaId, published: true };
  };

  const { data: pubAccount, error: pubErr } = await supabase
    .from('meta_publishing_accounts')
    .select('instagram_business_account_id, page_access_token, token_iv')
    .eq('tenant_id', companyId)
    .maybeSingle();

  if (pubErr || !pubAccount?.instagram_business_account_id || !pubAccount.page_access_token) {
    return {
      success: false,
      error: 'Instagram publishing account not configured. Connect a Facebook Page with IG Business.',
      errorKey: 'publishing_not_configured',
    };
  }

  const igUserId = pubAccount.instagram_business_account_id as string;
  let accessToken: string;
  try {
    accessToken = decryptToken(unpackToken(pubAccount.page_access_token as string));
  } catch {
    return { success: false, error: 'Could not decrypt Page access token.', errorKey: 'token_decrypt_failed' };
  }

  const rawSlides = (post.creative_assets as Array<{ url: string; type: string; slide_index: number }> | null) ?? [];
  const slides = [...rawSlides].sort((a, b) => a.slide_index - b.slide_index);
  if (slides.length === 0) {
    return fail('Post has no media slides.', 'no_media');
  }

  const signedUrls = await Promise.all(slides.map((s) => signMediaUrl(s.url)));
  const format = (post.content_format as CreativeContentFormat) ?? 'feed_post';
  const mediaKind = mapContentFormatToMediaType(format, slides.length, slides[0]?.type ?? 'image');
  const caption = (post.caption as string | null) ?? '';

  const graphBase = `https://graph.facebook.com/${GRAPH_VERSION}`;

  try {
    if (mediaKind === 'CAROUSEL') {
      const childIds: string[] = [];
      for (const url of signedUrls) {
        if (!url) continue;
        const isVideo = slides[childIds.length]?.type === 'video';
        const body = new URLSearchParams({
          is_carousel_item: 'true',
          access_token: accessToken,
          ...(isVideo ? { media_type: 'VIDEO', video_url: url } : { image_url: url }),
        });
        const res = await fetch(`${graphBase}/${igUserId}/media`, { method: 'POST', body });
        const json = (await res.json()) as { id?: string; error?: { message: string } };
        if (!res.ok || !json.id) {
          return fail(json.error?.message ?? `Carousel child creation failed (${res.status})`);
        }
        childIds.push(json.id);
      }

      const carouselBody = new URLSearchParams({
        media_type: 'CAROUSEL',
        caption,
        children: childIds.join(','),
        access_token: accessToken,
      });
      const containerRes = await fetch(`${graphBase}/${igUserId}/media`, { method: 'POST', body: carouselBody });
      const containerJson = (await containerRes.json()) as { id?: string; error?: { message: string } };
      if (!containerRes.ok || !containerJson.id) {
        return fail(containerJson.error?.message ?? `Carousel container failed (${containerRes.status})`);
      }

      const carouselReady = await waitForContainerReady(graphBase, containerJson.id, accessToken);
      if (!carouselReady.ready) {
        return fail(carouselReady.error ?? 'Carousel not ready');
      }

      const publishRes = await fetch(`${graphBase}/${igUserId}/media_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: containerJson.id, access_token: accessToken }),
      });
      const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
      if (!publishRes.ok || !publishJson.id) {
        return fail(publishJson.error?.message ?? `media_publish failed (${publishRes.status})`);
      }

      return succeed(publishJson.id);
    }

    const primaryUrl = signedUrls[0];
    if (!primaryUrl) {
      return fail('Could not resolve public media URL.', 'no_media');
    }

    const params = new URLSearchParams({
      access_token: accessToken,
      caption,
      ...(mediaKind === 'VIDEO'
        ? { media_type: 'REELS', video_url: primaryUrl }
        : { image_url: primaryUrl }),
    });

    const containerRes = await fetch(`${graphBase}/${igUserId}/media`, { method: 'POST', body: params });
    const containerJson = (await containerRes.json()) as { id?: string; error?: { message: string } };
    if (!containerRes.ok || !containerJson.id) {
      return fail(containerJson.error?.message ?? `Media container failed (${containerRes.status})`);
    }

    // Video/Reels need processing; images finish instantly (poll is a no-op for them).
    if (mediaKind === 'VIDEO') {
      const ready = await waitForContainerReady(graphBase, containerJson.id, accessToken);
      if (!ready.ready) {
        return fail(ready.error ?? 'Media not ready');
      }
    }

    const publishRes = await fetch(`${graphBase}/${igUserId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: containerJson.id, access_token: accessToken }),
    });
    const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (!publishRes.ok || !publishJson.id) {
      return fail(publishJson.error?.message ?? `media_publish failed (${publishRes.status})`);
    }

    return succeed(publishJson.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[publishInstagramPost]', msg);
    return fail(msg);
  }
}
