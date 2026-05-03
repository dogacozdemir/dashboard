import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { getPublicUrl } from '@/lib/storage/s3';
import type { SessionUser } from '@/types/user';
import { recordCreativePendingAdminTasks } from '@/features/admin/lib/adminTaskBridge';
import { trackActivity } from '@/features/gamification/actions/trackActivity';
import {
  premiumDataPersistErrorMessage,
  premiumSessionRequiredMessage,
} from '@/lib/i18n/premium-action-errors';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: await premiumSessionRequiredMessage() }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { files, companyId } = await request.json();

  await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();

  const rows = (files as Array<{
    name: string;
    s3Key: string;
    contentType: string;
    title?: string;
    caption?: string;
    platform?: 'meta' | 'google' | 'tiktok' | 'instagram' | 'linkedin' | 'x';
    scheduledDate?: string;
    scheduledTime?: string;
  }>)
    .map((f) => ({
      tenant_id:   companyId,
      title:       (f.title?.trim() || f.name.replace(/\.[^.]+$/, '')),
      url:         getPublicUrl(f.s3Key),
      type:        f.contentType.startsWith('video/') ? 'video' : 'image',
      status:      'pending',
      platform:    f.platform ?? null,
      caption:     f.caption?.trim() || null,
      scheduled_date: f.scheduledDate || null,
      scheduled_time: f.scheduledTime || null,
      uploaded_by: user.id,
    }));

  const { data: inserted, error } = await supabase
    .from('creative_assets')
    .insert(rows)
    .select('id, title, tenant_id');

  if (error) {
    console.error('[api/assets/creative]', error.message);
    return NextResponse.json({ error: await premiumDataPersistErrorMessage() }, { status: 500 });
  }

  if (inserted?.length) {
    void recordCreativePendingAdminTasks(
      inserted.map((r) => ({
        id:         r.id,
        tenant_id:  r.tenant_id,
        title:      r.title,
      })),
    );
  }

  try {
    await trackActivity('creative_uploaded', { batchCount: rows.length });
  } catch (e) {
    console.error('[trackActivity creative_uploaded]', e);
  }

  return NextResponse.json({ success: true, count: rows.length });
}
