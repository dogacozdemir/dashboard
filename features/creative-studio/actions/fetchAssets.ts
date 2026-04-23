'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { auth } from '@/lib/auth/config';
import { createPresignedDownloadUrl } from '@/lib/storage/s3';
import type { CreativeAsset, Revision, AssetStatus, VideoRevisionMeta, ImageRevisionMeta } from '../types';
import type { SessionUser } from '@/types/user';

function extractS3Key(value: string): string {
  if (!value) return '';
  // Accept both legacy full URL values and raw key storage.
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    } catch {
      return value;
    }
  }
  return value;
}

function normalizeDuplicateTenantKey(key: string): string {
  // Fix legacy keys shaped like: {tenantId}/creative/{tenantId}/file.ext
  const parts = key.split('/');
  if (
    parts.length >= 4 &&
    (parts[1] === 'creative' || parts[1] === 'brand') &&
    parts[0] === parts[2]
  ) {
    return [parts[0], parts[1], ...parts.slice(3)].join('/');
  }
  return key;
}

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

  const mapped = await Promise.all(
    data.map(async (a) => {
      const key = normalizeDuplicateTenantKey(extractS3Key(a.url));
      let signedUrl = a.url;
      let signedThumb = a.thumbnail_url;

      // Creative assets are currently stored in S3 private bucket -> sign for viewing.
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

  return mapped;
}

export async function fetchRevisions(assetId: string, companyId: string): Promise<Revision[]> {
  await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('revisions')
    .select('id, asset_id, comment, created_by, created_at, video_metadata, image_metadata')
    .eq('asset_id', assetId)
    .eq('tenant_id', companyId)
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

  const supabase = await createSupabaseServerClient();
  const { data: asset, error: assetError } = await supabase
    .from('creative_assets')
    .select('id, title, tenant_id, platform, caption, scheduled_date, scheduled_time, social_post_event_id')
    .eq('id', assetId)
    .eq('tenant_id', companyId)
    .single();

  if (assetError || !asset) {
    console.error('[updateAssetStatus] fetch asset', assetError?.message);
    return { success: false, error: assetError?.message ?? 'Asset not found' };
  }

  const { error } = await supabase
    .from('creative_assets')
    .update({ status })
    .eq('id', assetId)
    .eq('tenant_id', companyId);

  if (error) {
    console.error('[updateAssetStatus]', error.message);
    return { success: false, error: error.message };
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
      return {
        success: false,
        error: eventError?.message ?? 'Approved but failed to create calendar event',
      };
    }

    const { error: linkError } = await supabase
      .from('creative_assets')
      .update({ social_post_event_id: eventData.id })
      .eq('id', asset.id)
      .eq('tenant_id', companyId);

    if (linkError) {
      console.error('[updateAssetStatus] link calendar event', linkError.message);
      return {
        success: false,
        error: linkError.message,
      };
    }
  }

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
    return { success: false, error: revError.message };
  }

  const { error: statusError } = await supabase
    .from('creative_assets')
    .update({ status: 'revision' })
    .eq('id', assetId)
    .eq('tenant_id', tenantId);

  if (statusError) {
    console.error('[addRevision] status update', statusError.message);
    return { success: false, error: statusError.message };
  }

  return { success: true };
}
