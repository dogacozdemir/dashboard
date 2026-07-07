'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { decryptToken, unpackToken } from '@/lib/utils/crypto';
import { createPresignedDownloadUrl } from '@/lib/storage/s3';
import { extractS3Key, normalizeDuplicateTenantKey } from '@/features/creative-studio/lib/creativeS3Keys';
import type { CreativeContentFormat } from '@/features/creative-studio/types';

const GRAPH_VERSION = 'v18.0';

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
  const supabase = await createSupabaseServerClient();

  const { data: post, error: postErr } = await supabase
    .from('creative_posts')
    .select(
      `
      id, tenant_id, caption, platform, status, content_format,
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
    return { success: false, error: 'Post has no media slides.', errorKey: 'no_media' };
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
          return {
            success: false,
            error: json.error?.message ?? `Carousel child creation failed (${res.status})`,
          };
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
        return {
          success: false,
          error: containerJson.error?.message ?? `Carousel container failed (${containerRes.status})`,
        };
      }

      const publishRes = await fetch(`${graphBase}/${igUserId}/media_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: containerJson.id, access_token: accessToken }),
      });
      const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
      if (!publishRes.ok || !publishJson.id) {
        return {
          success: false,
          error: publishJson.error?.message ?? `media_publish failed (${publishRes.status})`,
        };
      }

      return { success: true, instagramMediaId: publishJson.id, published: true };
    }

    const primaryUrl = signedUrls[0];
    if (!primaryUrl) {
      return { success: false, error: 'Could not resolve public media URL.', errorKey: 'no_media' };
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
      return {
        success: false,
        error: containerJson.error?.message ?? `Media container failed (${containerRes.status})`,
      };
    }

    const publishRes = await fetch(`${graphBase}/${igUserId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: containerJson.id, access_token: accessToken }),
    });
    const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (!publishRes.ok || !publishJson.id) {
      return {
        success: false,
        error: publishJson.error?.message ?? `media_publish failed (${publishRes.status})`,
      };
    }

    return { success: true, instagramMediaId: publishJson.id, published: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[publishInstagramPost]', msg);
    return { success: false, error: msg };
  }
}
