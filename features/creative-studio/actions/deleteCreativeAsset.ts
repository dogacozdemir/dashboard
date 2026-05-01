'use server';

import { auth } from '@/lib/auth/config';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { deleteS3Object } from '@/lib/storage/s3';
import type { SessionUser } from '@/types/user';
import { getCreativeKeysToPurge } from '@/features/creative-studio/lib/creativeS3Keys';

export async function deleteCreativeAsset(
  assetId: string,
  companyId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const user = session.user as SessionUser;
  if (user.role !== 'super_admin') return { success: false, error: 'Forbidden' };

  const cid = await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data: row, error: fetchErr } = await supabase
    .from('creative_assets')
    .select('id, tenant_id, url, thumbnail_url')
    .eq('id', assetId)
    .eq('tenant_id', cid)
    .maybeSingle();

  if (fetchErr) {
    console.error('[deleteCreativeAsset] fetch', fetchErr.message);
    return { success: false, error: fetchErr.message };
  }
  if (!row) return { success: false, error: 'Not found' };

  const keys = getCreativeKeysToPurge(row.url, row.thumbnail_url, cid);

  const { error: delErr } = await supabase
    .from('creative_assets')
    .delete()
    .eq('id', assetId)
    .eq('tenant_id', cid);

  if (delErr) {
    console.error('[deleteCreativeAsset] db delete', delErr.message);
    return { success: false, error: delErr.message };
  }

  await Promise.all(
    keys.map((key) =>
      deleteS3Object('creative', key).catch((e) => {
        console.error('[deleteCreativeAsset] S3 delete failed', key, e);
      }),
    ),
  );

  return { success: true };
}
