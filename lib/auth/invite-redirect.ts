import type { SupabaseClient } from '@supabase/supabase-js';
import { getTenantDashboardUrl } from '@/lib/utils/tenant-urls';

/**
 * Builds a tenant-subdomain set-password URL for Supabase Auth invite `redirectTo`.
 * Invited users land on `{slug}.{ROOT_DOMAIN}/set-password`, where they consume
 * the invite token and choose their first password before entering the app.
 */
export async function getInviteLoginRedirectUrl(
  admin: SupabaseClient,
  tenantId: string,
): Promise<{ redirectTo: string } | { error: string }> {
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('[getInviteLoginRedirectUrl]', error.message);
    return { error: 'TENANT_LOOKUP_FAILED' };
  }

  if (!tenant?.slug) {
    return { error: 'TENANT_NOT_FOUND' };
  }

  return { redirectTo: getTenantDashboardUrl(tenant.slug as string, '/set-password') };
}
