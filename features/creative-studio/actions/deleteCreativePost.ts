'use server';

import { auth } from '@/lib/auth/config';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SessionUser } from '@/types/user';
import { deleteS3Object } from '@/lib/storage/s3';
import { getCreativeKeysToPurge } from '@/features/creative-studio/lib/creativeS3Keys';

/**
 * Hard-delete a creative **post** (carousel or single): removes all slides, revisions, and S3 objects.
 */
export async function deleteCreativePost(
  postId: string,
  companyId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    const { premiumSessionRequiredMessage } = await import('@/lib/i18n/premium-action-errors');
    return { success: false, error: await premiumSessionRequiredMessage() };
  }

  const user = session.user as SessionUser;
  if (user.role !== 'super_admin') return { success: false, error: 'Forbidden' };

  const cid = await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data: slides, error: fetchErr } = await supabase
    .from('creative_assets')
    .select('id, url, thumbnail_url')
    .eq('post_id', postId)
    .eq('tenant_id', cid);

  if (fetchErr) {
    console.error('[deleteCreativePost] fetch slides', fetchErr.message);
    return { success: false, error: fetchErr.message };
  }

  const keys = new Set<string>();
  for (const row of slides ?? []) {
    for (const k of getCreativeKeysToPurge(row.url, row.thumbnail_url, cid)) {
      keys.add(k);
    }
  }

  const { error: delErr } = await supabase.from('creative_posts').delete().eq('id', postId).eq('tenant_id', cid);

  if (delErr) {
    console.error('[deleteCreativePost] db delete', delErr.message);
    return { success: false, error: delErr.message };
  }

  await Promise.all(
    [...keys].map((key) =>
      deleteS3Object('creative', key).catch((e) => {
        console.error('[deleteCreativePost] S3 delete failed', key, e);
      }),
    ),
  );

  return { success: true };
}
