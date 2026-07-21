'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isScopedTenantHostSlug } from '@/lib/utils/parse-tenant-host';

export type LoginTenantValidation =
  | { ok: true }
  | { ok: false; errorKey: 'tenantAccessDenied' };

/**
 * Ensures a non–super-admin user belongs to the tenant subdomain they are signing into.
 * Super admins may sign in on any tenant host.
 */
export async function validateLoginTenant(
  email: string,
  hostTenantSlug: string,
): Promise<LoginTenantValidation> {
  const slug = hostTenantSlug.trim().toLowerCase();
  if (!isScopedTenantHostSlug(slug)) {
    return { ok: true };
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) {
    return { ok: true };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: userRow, error } = await admin
      .from('users')
      .select('role, tenant_id')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (error || !userRow) {
      return { ok: true };
    }

    if (userRow.role === 'super_admin') {
      return { ok: true };
    }

    const { data: tenantRow } = await admin
      .from('tenants')
      .select('slug')
      .eq('id', userRow.tenant_id as string)
      .maybeSingle();

    const userSlug = (tenantRow?.slug as string | undefined)?.trim().toLowerCase();
    if (userSlug && userSlug !== slug) {
      return { ok: false, errorKey: 'tenantAccessDenied' };
    }

    return { ok: true };
  } catch {
    return { ok: true };
  }
}
