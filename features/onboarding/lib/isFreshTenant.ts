import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * True when the tenant has no campaigns, creative assets, or connected ad accounts yet
 * — first-time / empty blueprint experience.
 */
export async function isTenantFreshStart(companyId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const [campaigns, assets, accounts, brand] = await Promise.all([
    supabase.from('ad_campaigns').select('id', { count: 'exact', head: true }).eq('tenant_id', companyId),
    supabase.from('creative_assets').select('id', { count: 'exact', head: true }).eq('tenant_id', companyId),
    supabase.from('ad_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', companyId),
    supabase.from('brand_assets').select('id', { count: 'exact', head: true }).eq('tenant_id', companyId),
  ]);

  const n =
    (campaigns.count ?? 0) +
    (assets.count ?? 0) +
    (accounts.count ?? 0) +
    (brand.count ?? 0);
  return n === 0;
}
