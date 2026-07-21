'use server';

import { getPremiumActionError } from '@/lib/copy/premium-copy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { requirePermission } from '@/lib/auth/permissions';
import { auth } from '@/lib/auth/config';
import { trackActivity } from '@/features/gamification/actions/trackActivity';
import { createPresignedDownloadUrl } from '@/lib/storage/s3';
import type {
  CreativePost,
  CreativeSlide,
  CreativeContentFormat,
  Revision,
  AssetStatus,
  VideoRevisionMeta,
  ImageRevisionMeta,
} from '../types';
import type { SessionUser } from '@/types/user';
import {
  recordCreativeRevisionAdminTask,
  resolveCreativeAdminTasksAfterStatus,
} from '@/features/admin/lib/adminTaskBridge';
import { notifyAgencyCreativeEvent } from '@/lib/email/notify';
import { extractS3Key, normalizeDuplicateTenantKey } from '@/features/creative-studio/lib/creativeS3Keys';

async function signCreativeUrl(rawUrl: string | null): Promise<string | null> {
  if (!rawUrl) return null;
  // Dev-only: skip presigner round-trips when DB URLs already hit public bucket/CDN.
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.CREATIVE_PUBLIC_MEDIA_DEV === '1' &&
    (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
  ) {
    return rawUrl;
  }
  const key = normalizeDuplicateTenantKey(extractS3Key(rawUrl));
  if (!key) return rawUrl;
  try {
    return await createPresignedDownloadUrl({ bucket: 'creative', key, expiresIn: 3600 });
  } catch {
    return rawUrl;
  }
}

async function hydrateSlideUrls(slide: {
  id: string;
  slide_index: number;
  title: string;
  url: string;
  thumbnail_url: string | null;
  type: string;
  created_at: string;
}): Promise<CreativeSlide> {
  const [url, thumbnailUrl] = await Promise.all([
    signCreativeUrl(slide.url),
    signCreativeUrl(slide.thumbnail_url),
  ]);
  return {
    id: slide.id,
    slideIndex: slide.slide_index,
    title: slide.title,
    url: url ?? slide.url,
    thumbnailUrl,
    type: slide.type as CreativeSlide['type'],
    createdAt: slide.created_at,
  };
}

export async function fetchCreativePosts(companyId: string): Promise<CreativePost[]> {
  const validatedId = await requireTenantAction(companyId);

  /** RLS uses auth.uid(); session comes from Supabase Auth cookies set at Credentials login (signInWithPassword). */
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('creative_posts')
    .select(
      `
      id, title, caption, platform, content_format, status, scheduled_date, scheduled_time, social_post_event_id, thumbnail_url, uploaded_by, created_at,
      creative_assets ( id, slide_index, title, url, thumbnail_url, type, created_at )
    `,
    )
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchCreativePosts]', error.message);
    return [];
  }

  if (!data?.length) return [];

  const mapped: CreativePost[] = [];

  const PRESIGN_CONCURRENCY = 8;
  for (let i = 0; i < data.length; i += PRESIGN_CONCURRENCY) {
    const slice = data.slice(i, i + PRESIGN_CONCURRENCY);
    const part = await Promise.all(
      slice.map(async (row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawSlides = (row as any).creative_assets as Array<{
          id: string;
          slide_index: number;
          title: string;
          url: string;
          thumbnail_url: string | null;
          type: string;
          created_at: string;
        }> | null;

        const slidesUnsorted = rawSlides ?? [];
        slidesUnsorted.sort((a, b) => a.slide_index - b.slide_index);

        const slides = await Promise.all(slidesUnsorted.map((s) => hydrateSlideUrls(s)));

        let posterThumbnailUrl = await signCreativeUrl(row.thumbnail_url as string | null);
        const firstSlide = slides[0];
        if (!posterThumbnailUrl && firstSlide) {
          posterThumbnailUrl = firstSlide.thumbnailUrl ?? firstSlide.url;
        }

        return {
          id: row.id,
          title: row.title as string,
          caption: row.caption ?? null,
          platform: (row.platform as CreativePost['platform']) ?? null,
          contentFormat: ((row as { content_format?: string }).content_format as CreativeContentFormat) ?? 'feed_post',
          status: row.status as AssetStatus,
          scheduledDate: row.scheduled_date ?? null,
          scheduledTime: row.scheduled_time ?? null,
          socialPostEventId: row.social_post_event_id ?? null,
          posterThumbnailUrl,
          uploadedBy: row.uploaded_by as string,
          createdAt: row.created_at as string,
          slides,
        } satisfies CreativePost;
      }),
    );
    mapped.push(...part);
  }

  return mapped;
}

/** Approved Instagram posts with a schedule — for IG feed simulation. */
export async function fetchInstagramFeedPosts(companyId: string): Promise<CreativePost[]> {
  const posts = await fetchCreativePosts(companyId);
  return posts
    .filter(
      (p) =>
        p.status === 'approved' &&
        p.platform === 'instagram' &&
        Boolean(p.scheduledDate),
    )
    .sort((a, b) => {
      const dateCmp = (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '');
      if (dateCmp !== 0) return dateCmp;
      return (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '');
    });
}

async function slideIdsForPost(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, postId: string, tenantId: string) {
  const { data, error } = await supabase
    .from('creative_assets')
    .select('id')
    .eq('post_id', postId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[slideIdsForPost]', error.message);
    return [];
  }
  return (data ?? []).map((r) => r.id as string);
}

/** Resolve auth user ids → human-readable display names (full_name, else email prefix). */
async function buildUserNameMap(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const { data } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', ids);

  for (const row of data ?? []) {
    const name =
      (row.full_name as string | null)?.trim() ||
      (row.email as string | null)?.split('@')[0] ||
      (row.id as string);
    map.set(row.id as string, name);
  }
  return map;
}

export async function fetchRevisionsForPost(postId: string, companyId: string): Promise<Revision[]> {
  const cid = await requireTenantAction(companyId);
  const supabase = await createSupabaseServerClient();
  const ids = await slideIdsForPost(supabase, postId, cid);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('revisions')
    .select(
      'id, asset_id, slide_index, comment, created_by, created_at, updated_at, resolved_at, resolved_by, video_metadata, image_metadata',
    )
    .in('asset_id', ids)
    .eq('tenant_id', cid)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[fetchRevisionsForPost]', error.message);
    return [];
  }

  const rows = data ?? [];
  const nameMap = await buildUserNameMap(
    supabase,
    rows.flatMap((r) => [r.created_by as string, r.resolved_by as string | null]),
  );

  return rows.map((r) => ({
    id:            r.id,
    assetId:       r.asset_id,
    slideIndex:    r.slide_index !== null && r.slide_index !== undefined ? Number(r.slide_index) : null,
    comment:       r.comment,
    createdBy:     nameMap.get(r.created_by as string) ?? (r.created_by as string),
    createdById:   r.created_by as string,
    createdAt:     r.created_at,
    updatedAt:     (r.updated_at as string | null) ?? null,
    resolvedAt:    (r.resolved_at as string | null) ?? null,
    resolvedBy:    r.resolved_by ? (nameMap.get(r.resolved_by as string) ?? null) : null,
    videoMetadata: (r.video_metadata as VideoRevisionMeta | null) ?? null,
    imageMetadata: (r.image_metadata as ImageRevisionMeta | null) ?? null,
  }));
}

/** @deprecated Use fetchRevisionsForPost — kept for incremental refactors */
export async function fetchRevisions(assetId: string, companyId: string): Promise<Revision[]> {
  const cid = await requireTenantAction(companyId);
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from('creative_assets')
    .select('post_id')
    .eq('id', assetId)
    .eq('tenant_id', cid)
    .maybeSingle();
  const postId = row?.post_id as string | undefined;
  if (!postId) return [];
  return fetchRevisionsForPost(postId, companyId);
}

export async function updateCreativePostStatus(
  postId: string,
  status: AssetStatus,
  companyId: string
): Promise<{
  success: boolean;
  error?: string;
  gamification?: Awaited<ReturnType<typeof trackActivity>> | null;
}> {
  await requireTenantAction(companyId);
  await requirePermission('creative.approve');

  const supabase = await createSupabaseServerClient();
  const { data: post, error: postError } = await supabase
    .from('creative_posts')
    .select(
      'id, title, tenant_id, platform, caption, scheduled_date, scheduled_time, social_post_event_id, created_at',
    )
    .eq('id', postId)
    .eq('tenant_id', companyId)
    .single();

  if (postError || !post) {
    console.error('[updateCreativePostStatus] fetch post', postError?.message);
    return { success: false, error: await getPremiumActionError() };
  }

  const { error } = await supabase
    .from('creative_posts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('tenant_id', companyId);

  if (error) {
    console.error('[updateCreativePostStatus]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }

  let gamification: Awaited<ReturnType<typeof trackActivity>> | null = null;
  if (status === 'approved') {
    gamification = await trackActivity('creative_approved', {
      uploadedAt: post.created_at as string,
    });
  }

  if (status === 'approved' && !post.social_post_event_id && post.scheduled_date) {
    const session = await auth();
    const userId = (session?.user as SessionUser | undefined)?.id ?? null;

    const { data: eventData, error: eventError } = await supabase
      .from('calendar_events')
      .insert({
        tenant_id: companyId,
        event_type: 'social_post',
        title: post.title,
        description: null,
        event_date: post.scheduled_date,
        event_time: post.scheduled_time ?? null,
        platform: post.platform ?? 'instagram',
        caption: post.caption ?? null,
        creative_post_id: post.id,
        status: 'scheduled',
        created_by: userId,
      })
      .select('id')
      .single();

    if (eventError || !eventData) {
      console.error('[updateCreativePostStatus] create calendar event', eventError?.message);
      return { success: false, error: await getPremiumActionError() };
    }

    const { error: linkError } = await supabase
      .from('creative_posts')
      .update({ social_post_event_id: eventData.id })
      .eq('id', post.id)
      .eq('tenant_id', companyId);

    if (linkError) {
      console.error('[updateCreativePostStatus] link calendar event', linkError.message);
      return { success: false, error: await getPremiumActionError() };
    }
  }

  void resolveCreativeAdminTasksAfterStatus({
    postId,
    tenantId: companyId,
    newStatus: status,
    postTitle: post.title as string,
  });

  if (status === 'approved') {
    const approver = (await auth())?.user as SessionUser | undefined;
    void notifyAgencyCreativeEvent({
      tenantId: companyId,
      postTitle: post.title as string,
      kind: 'approved',
      byName: approver?.name ?? undefined,
    });
  }

  return { success: true, gamification };
}

/** Alias — first argument is creative post UUID. */
export const updateAssetStatus = updateCreativePostStatus;

export async function addRevision(input: {
  postId: string;
  tenantId: string;
  /** Slide row UUID to satisfy FK (`creative_assets`). Whole-post comments use slide 0. */
  anchorAssetId: string;
  /** Matches `creative_assets.slide_index`; `null` = whole carousel/post. */
  slideIndex: number | null;
  comment: string;
  videoMetadata: VideoRevisionMeta | null;
  imageMetadata: ImageRevisionMeta | null;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    const { premiumSessionRequiredMessage } = await import('@/lib/i18n/premium-action-errors');
    return { success: false, error: await premiumSessionRequiredMessage() };
  }

  const userId = (session.user as SessionUser).id;
  await requireTenantAction(input.tenantId);

  const supabase = await createSupabaseServerClient();

  const { error: revError } = await supabase.from('revisions').insert({
    asset_id:       input.anchorAssetId,
    tenant_id:      input.tenantId,
    comment:        input.comment,
    created_by:     userId,
    video_metadata: input.videoMetadata ?? null,
    image_metadata: input.imageMetadata ?? null,
    slide_index:    input.slideIndex,
  });

  if (revError) {
    console.error('[addRevision] insert', revError.message);
    return { success: false, error: await getPremiumActionError() };
  }

  const { error: statusError } = await supabase
    .from('creative_posts')
    .update({ status: 'revision', updated_at: new Date().toISOString() })
    .eq('id', input.postId)
    .eq('tenant_id', input.tenantId);

  if (statusError) {
    console.error('[addRevision] post status update', statusError.message);
    return { success: false, error: await getPremiumActionError() };
  }

  const { data: postRow } = await supabase
    .from('creative_posts')
    .select('title')
    .eq('id', input.postId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  void recordCreativeRevisionAdminTask({
    postId: input.postId,
    tenantId: input.tenantId,
    postTitle: (postRow?.title as string) ?? 'Kreatif',
  });

  // Best-effort out-of-app: tell the agency a client requested a revision.
  void notifyAgencyCreativeEvent({
    tenantId: input.tenantId,
    postTitle: (postRow?.title as string) ?? 'Kreatif',
    kind: 'revision',
    byName: (session.user as SessionUser).name ?? undefined,
  });

  return { success: true };
}

/** Reviewer marks a revision resolved (or reopens it). Requires creative.approve. */
export async function setRevisionResolved(
  revisionId: string,
  tenantId: string,
  resolved: boolean,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: await getPremiumActionError() };
  await requireTenantAction(tenantId);
  await requirePermission('creative.approve');

  const userId = (session.user as SessionUser).id;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('revisions')
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? userId : null,
    })
    .eq('id', revisionId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[setRevisionResolved]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }
  return { success: true };
}

/** Author (or super_admin) edits their own revision text/metadata. */
export async function editRevision(input: {
  revisionId: string;
  tenantId: string;
  comment: string;
  videoMetadata: VideoRevisionMeta | null;
  imageMetadata: ImageRevisionMeta | null;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: await getPremiumActionError() };
  await requireTenantAction(input.tenantId);

  const user = session.user as SessionUser;
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchErr } = await supabase
    .from('revisions')
    .select('created_by')
    .eq('id', input.revisionId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { success: false, error: await getPremiumActionError() };
  }
  const isAuthor = (existing.created_by as string) === user.id;
  if (!isAuthor && user.role !== 'super_admin') {
    return { success: false, error: await getPremiumActionError() };
  }

  const { error } = await supabase
    .from('revisions')
    .update({
      comment:        input.comment,
      video_metadata: input.videoMetadata ?? null,
      image_metadata: input.imageMetadata ?? null,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', input.revisionId)
    .eq('tenant_id', input.tenantId);

  if (error) {
    console.error('[editRevision]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }
  return { success: true };
}

/** Author (or super_admin) deletes their own revision. */
export async function deleteRevision(
  revisionId: string,
  tenantId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: await getPremiumActionError() };
  await requireTenantAction(tenantId);

  const user = session.user as SessionUser;
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchErr } = await supabase
    .from('revisions')
    .select('created_by')
    .eq('id', revisionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { success: false, error: await getPremiumActionError() };
  }
  const isAuthor = (existing.created_by as string) === user.id;
  if (!isAuthor && user.role !== 'super_admin') {
    return { success: false, error: await getPremiumActionError() };
  }

  const { error } = await supabase
    .from('revisions')
    .delete()
    .eq('id', revisionId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[deleteRevision]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }
  return { success: true };
}
