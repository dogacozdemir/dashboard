'use server';

import { getPremiumActionError } from '@/lib/copy/premium-copy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { requirePermission } from '@/lib/auth/permissions';
import { auth } from '@/lib/auth/config';
import { createPresignedDownloadUrl } from '@/lib/storage/s3';
import type { CreativeAsset, Revision, AssetStatus, VideoRevisionMeta, ImageRevisionMeta } from '../types';
import type { SessionUser } from '@/types/user';
import {
  recordCreativeRevisionAdminTask,
  resolveCreativeAdminTasksAfterStatus,
} from '@/features/admin/lib/adminTaskBridge';
import { extractS3Key, normalizeDuplicateTenantKey } from '@/features/creative-studio/lib/creativeS3Keys';

export async function fetchCreativeAssets(companyId: string): Promise<CreativeAsset[]> {
  const validatedId = await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('creative_assets')
    .select('id, title, url, thumbnail_url, type, status, uploaded_by, platform, caption, scheduled_date, scheduled_time, social_post_event_id, created_at')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchCreativeAssets]', error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  /** Cap parallel S3 presigns to avoid thundering herd on cold gallery loads. */
  const PRESIGN_CONCURRENCY = 6;
  const mapped: CreativeAsset[] = [];

  for (let i = 0; i < data.length; i += PRESIGN_CONCURRENCY) {
    const slice = data.slice(i, i + PRESIGN_CONCURRENCY);
    const part = await Promise.all(
      slice.map(async (a) => {
        const key = normalizeDuplicateTenantKey(extractS3Key(a.url));
        let signedUrl = a.url;
        let signedThumb = a.thumbnail_url;

        if (key) {
          try {
            signedUrl = await createPresignedDownloadUrl({
              bucket: 'creative',
              key,
              expiresIn: 3600,
            });
          } catch {
            signedUrl = a.url;
          }
        }

        if (a.thumbnail_url) {
          const thumbKey = normalizeDuplicateTenantKey(extractS3Key(a.thumbnail_url));
          if (thumbKey) {
            try {
              signedThumb = await createPresignedDownloadUrl({
                bucket: 'creative',
                key: thumbKey,
                expiresIn: 3600,
              });
            } catch {
              signedThumb = a.thumbnail_url;
            }
          }
        }

        return {
          id:           a.id,
          title:        a.title,
          url:          signedUrl,
          thumbnailUrl: signedThumb,
          type:         a.type as 'image' | 'video',
          status:       a.status as AssetStatus,
          uploadedBy:   a.uploaded_by,
          platform:     (a.platform as CreativeAsset['platform']) ?? null,
          caption:      a.caption ?? null,
          scheduledDate: a.scheduled_date ?? null,
          scheduledTime: a.scheduled_time ?? null,
          socialPostEventId: a.social_post_event_id ?? null,
          createdAt:    a.created_at,
        } satisfies CreativeAsset;
      })
    );
    mapped.push(...part);
  }

  return mapped;
}

export async function fetchRevisions(assetId: string, companyId: string): Promise<Revision[]> {
  const cid = await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('revisions')
    .select('id, asset_id, comment, created_by, created_at, video_metadata, image_metadata')
    .eq('asset_id', assetId)
    .eq('tenant_id', cid)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[fetchRevisions]', error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id:            r.id,
    assetId:       r.asset_id,
    comment:       r.comment,
    createdBy:     r.created_by,
    createdAt:     r.created_at,
    videoMetadata: (r.video_metadata as VideoRevisionMeta | null) ?? null,
    imageMetadata: (r.image_metadata as ImageRevisionMeta | null) ?? null,
  }));
}

export async function updateAssetStatus(
  assetId: string,
  status: AssetStatus,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  await requireTenantAction(companyId);
  await requirePermission('creative.approve');

  const supabase = await createSupabaseServerClient();
  const { data: asset, error: assetError } = await supabase
    .from('creative_assets')
    .select('id, title, tenant_id, platform, caption, scheduled_date, scheduled_time, social_post_event_id')
    .eq('id', assetId)
    .eq('tenant_id', companyId)
    .single();

  if (assetError || !asset) {
    console.error('[updateAssetStatus] fetch asset', assetError?.message);
    return { success: false, error: await getPremiumActionError() };
  }

  const { error } = await supabase
    .from('creative_assets')
    .update({ status })
    .eq('id', assetId)
    .eq('tenant_id', companyId);

  if (error) {
    console.error('[updateAssetStatus]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }

  // Bridge: when approved, automatically create Ops Calendar social post event once.
  if (
    status === 'approved' &&
    !asset.social_post_event_id &&
    asset.scheduled_date
  ) {
    const session = await auth();
    const userId = (session?.user as SessionUser | undefined)?.id ?? null;

    const { data: eventData, error: eventError } = await supabase
      .from('calendar_events')
      .insert({
        tenant_id: companyId,
        event_type: 'social_post',
        title: asset.title,
        description: null,
        event_date: asset.scheduled_date,
        event_time: asset.scheduled_time ?? null,
        platform: asset.platform ?? 'instagram',
        caption: asset.caption ?? null,
        creative_id: asset.id,
        status: 'scheduled',
        created_by: userId,
      })
      .select('id')
      .single();

    if (eventError || !eventData) {
      console.error('[updateAssetStatus] create calendar event', eventError?.message);
      return { success: false, error: await getPremiumActionError() };
    }

    const { error: linkError } = await supabase
      .from('creative_assets')
      .update({ social_post_event_id: eventData.id })
      .eq('id', asset.id)
      .eq('tenant_id', companyId);

    if (linkError) {
      console.error('[updateAssetStatus] link calendar event', linkError.message);
      return { success: false, error: await getPremiumActionError() };
    }
  }

  void resolveCreativeAdminTasksAfterStatus({
    assetId,
    tenantId: companyId,
    newStatus: status,
    assetTitle: asset.title,
  });

  return { success: true };
}

export async function addRevision(
  assetId:       string,
  tenantId:      string,
  comment:       string,
  videoMetadata: VideoRevisionMeta | null = null,
  imageMetadata: ImageRevisionMeta | null = null,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = (session.user as SessionUser).id;
  await requireTenantAction(tenantId);

  const supabase = await createSupabaseServerClient();

  const { error: revError } = await supabase.from('revisions').insert({
    asset_id:       assetId,
    tenant_id:      tenantId,
    comment,
    created_by:     userId,
    video_metadata: videoMetadata ?? null,
    image_metadata: imageMetadata ?? null,
  });

  if (revError) {
    console.error('[addRevision] insert', revError.message);
    return { success: false, error: await getPremiumActionError() };
  }

  const { error: statusError } = await supabase
    .from('creative_assets')
    .update({ status: 'revision' })
    .eq('id', assetId)
    .eq('tenant_id', tenantId);

  if (statusError) {
    console.error('[addRevision] status update', statusError.message);
    return { success: false, error: await getPremiumActionError() };
  }

  const { data: assetRow } = await supabase
    .from('creative_assets')
    .select('title')
    .eq('id', assetId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  void recordCreativeRevisionAdminTask({
    assetId,
    tenantId,
    assetTitle: (assetRow?.title as string) ?? 'Kreatif',
  });

  return { success: true };
}
