import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Per-request memoized: showroom tenants skip real analytics writes/reads. */
export const isDemoTenant = cache(async (tenantId: string): Promise<boolean> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('is_demo')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean((data as { is_demo?: boolean }).is_demo);
});
