import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { getPublicUrl } from '@/lib/storage/s3';
import type { SessionUser } from '@/types/user';
import { recordCreativePendingAdminTasks } from '@/features/admin/lib/adminTaskBridge';
import { notifyCreativePendingReview } from '@/lib/email/notify';
import { trackActivity } from '@/features/gamification/actions/trackActivity';
import {
  premiumDataPersistErrorMessage,
  premiumSessionRequiredMessage,
} from '@/lib/i18n/premium-action-errors';

type CreativeContentFormat = 'feed_post' | 'carousel' | 'reel' | 'story';

type UploadFileMeta = {
  name: string;
  s3Key: string;
  contentType: string;
  size?: number;
  title?: string;
  caption?: string;
  platform?: 'meta' | 'google' | 'tiktok' | 'instagram' | 'linkedin' | 'x';
  scheduledDate?: string;
  scheduledTime?: string;
};

type SharedMetadata = {
  title: string;
  caption?: string;
  platform?: UploadFileMeta['platform'];
  scheduledDate?: string;
  scheduledTime?: string;
  contentFormat?: CreativeContentFormat;
};

function inferContentFormat(
  explicit: CreativeContentFormat | undefined,
  kind: 'single' | 'carousel',
  files: UploadFileMeta[],
): CreativeContentFormat {
  const isCarousel = kind === 'carousel' || files.length > 1;
  if (isCarousel) {
    return 'carousel';
  }
  const singleMedia: CreativeContentFormat[] = ['feed_post', 'reel', 'story'];
  if (explicit && singleMedia.includes(explicit)) {
    return explicit;
  }
  const f0 = files[0];
  if (!f0) return 'feed_post';
  return f0.contentType.startsWith('video/') ? 'reel' : 'feed_post';
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: await premiumSessionRequiredMessage() }, { status: 401 });
  }

  const user = session.user as SessionUser;

  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as {
    kind?: 'single' | 'carousel';
    companyId: string;
    files: UploadFileMeta[];
    metadata?: SharedMetadata;
    contentFormat?: CreativeContentFormat;
  };

  const kind = body.kind ?? 'single';
  const companyId = body.companyId;
  const effectiveFiles = Array.isArray(body.files) ? body.files : [];

  if (effectiveFiles.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  if (kind === 'carousel' && effectiveFiles.length < 2) {
    return NextResponse.json(
      { error: 'Carousel uploads require at least two files' },
      { status: 400 },
    );
  }

  const f0 = effectiveFiles[0];
  const meta = body.metadata;

  const shared: SharedMetadata = {
    title:
      meta?.title?.trim()
      ?? f0.title?.trim()
      ?? f0.name.replace(/\.[^.]+$/, ''),
    caption: meta?.caption ?? f0.caption,
    platform: meta?.platform ?? f0.platform,
    scheduledDate: meta?.scheduledDate ?? f0.scheduledDate,
    scheduledTime: meta?.scheduledTime ?? f0.scheduledTime,
    contentFormat: meta?.contentFormat ?? body.contentFormat,
  };

  const resolvedFormat = inferContentFormat(
    shared.contentFormat,
    kind,
    effectiveFiles,
  );

  await requireTenantAction(companyId);

  /**
   * Prefer the cookie-backed anon client so RLS sees auth.uid() and auth_is_super_admin().
   * If the Supabase JWT is missing or stale (common when NextAuth outlives Supabase refresh),
   * fall back to service-role only after NextAuth + requireTenantAction — same pattern as adminTaskBridge.
   */
  const supabaseAnon = await createSupabaseServerClient();
  const { data: sbAuth } = await supabaseAnon.auth.getUser();
  const supabase =
    sbAuth.user?.id === user.id ? supabaseAnon : createSupabaseAdminClient();
  if (!sbAuth.user || sbAuth.user.id !== user.id) {
    console.warn(
      '[api/assets/creative] Supabase JWT missing or user mismatch — using service client after NextAuth gate',
    );
  }

  const posterUrl = getPublicUrl(f0.s3Key);

  /** DB tenant_id must equal payload + requireTenantAction (proxy-resolved active tenant), never JWT home tenant. */
  const { data: postRow, error: postErr } = await supabase
    .from('creative_posts')
    .insert({
      tenant_id:        companyId,
      title:            shared.title,
      caption:          shared.caption?.trim() || null,
      platform:         shared.platform ?? null,
      content_format:   resolvedFormat,
      status:           'pending',
      scheduled_date:   shared.scheduledDate || null,
      scheduled_time:   shared.scheduledTime || null,
      thumbnail_url:    posterUrl,
      uploaded_by:      user.id,
    })
    .select('id, title')
    .single();

  if (postErr || !postRow) {
    console.error('[api/assets/creative] post insert', postErr?.message);
    return NextResponse.json({ error: await premiumDataPersistErrorMessage() }, { status: 500 });
  }

  const postId = postRow.id as string;

  const slides = effectiveFiles.map((f, slideIndex) => ({
    tenant_id:     companyId,
    post_id:       postId,
    slide_index:   slideIndex,
    title:
      kind === 'carousel'
        ? (f.title?.trim() || `${shared.title} · ${slideIndex + 1}`)
        : shared.title,
    url:           getPublicUrl(f.s3Key),
    type:          f.contentType.startsWith('video/') ? 'video' as const : 'image' as const,
    file_size:     f.size ?? null,
    uploaded_by:   user.id,
    thumbnail_url: f.contentType.startsWith('video/') ? null : getPublicUrl(f.s3Key),
  }));

  const { data: insertedSlides, error: slidesErr } = await supabase
    .from('creative_assets')
    .insert(slides)
    .select('id');

  if (slidesErr || !insertedSlides?.length) {
    console.error('[api/assets/creative] slides insert', slidesErr?.message);
    await supabase.from('creative_posts').delete().eq('id', postId);
    return NextResponse.json({ error: await premiumDataPersistErrorMessage() }, { status: 500 });
  }

  void recordCreativePendingAdminTasks([
    {
      id:        postId,
      tenant_id: companyId,
      title:     postRow.title as string,
    },
  ]);

  // Best-effort out-of-app delivery: email the client team that a creative awaits review.
  void notifyCreativePendingReview({ tenantId: companyId, postTitle: postRow.title as string });

  try {
    await trackActivity('creative_uploaded', { batchCount: 1 });
  } catch (e) {
    console.error('[trackActivity creative_uploaded]', e);
  }

  return NextResponse.json({
    success: true,
    postId,
    slideCount: insertedSlides.length,
  });
}
