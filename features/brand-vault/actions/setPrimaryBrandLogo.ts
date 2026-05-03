'use server';

import { auth } from '@/lib/auth/config';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { canSetTenantPrimaryLogo } from '@/features/gamification/lib/definitions';
import type { SessionUser } from '@/types/user';

export async function setPrimaryBrandLogo(
  companyId: string,
  brandAssetId: string,
): Promise<{ success: boolean; error?: string }> {
  const validated = await requireTenantAction(companyId);
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!sessionHasPermission(user, 'brand.upload')) {
    return { success: false, error: 'Missing brand.upload permission' };
  }

  const supabase = await createSupabaseServerClient();

  const { data: xpRow } = await supabase.from('users').select('xp').eq('id', user.id).maybeSingle();
  const xp = Number((xpRow as { xp?: number } | null)?.xp ?? 0);
  if (!canSetTenantPrimaryLogo(xp, user.role)) {
    return {
      success: false,
      error: 'Brand Architect (Level 5) required to set primary logo.',
    };
  }

  const { data: asset, error: aErr } = await supabase
    .from('brand_assets')
    .select('id, tenant_id, type, url')
    .eq('id', brandAssetId)
    .maybeSingle();

  if (aErr || !asset) return { success: false, error: 'Asset not found' };
  if (asset.tenant_id !== validated) return { success: false, error: 'Forbidden' };
  if (asset.type !== 'logo') return { success: false, error: 'Only logo assets can be primary' };
  const url = String(asset.url ?? '').trim();
  if (!url) return { success: false, error: 'Missing file URL' };

  const { error: uErr } = await supabase
    .from('tenants')
    .update({ brand_logo_url: url })
    .eq('id', validated);

  if (uErr) {
    console.error('[setPrimaryBrandLogo]', uErr.message);
    return { success: false, error: uErr.message };
  }

  return { success: true };
}
