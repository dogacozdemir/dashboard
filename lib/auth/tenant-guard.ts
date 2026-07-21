import { cache } from 'react';
import { headers } from 'next/headers';
import { getCachedSession } from '@/lib/auth/cached-auth';
import { resolveRequestTenantSlug } from '@/lib/auth/resolve-request-tenant-slug';
import { getTenantBySlug } from '@/lib/supabase/server';
import type { TenantContext } from '@/types/tenant';
import type { SessionUser } from '@/types/user';
import { signBrandLogoUrl } from '@/lib/storage/brand-logo';

export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const headersList = await headers();
  const tenantSlug = await resolveRequestTenantSlug();

  if (!tenantSlug || tenantSlug === 'www' || tenantSlug === 'admin') return null;

  const tenantRaw = await getTenantBySlug(tenantSlug);
  if (!tenantRaw) return null;

  const headerCompanyId = headersList.get('x-company-id')?.trim() ?? '';
  const tenantId = (tenantRaw as { id: string }).id;

  if (headerCompanyId && headerCompanyId !== tenantId) {
    return null;
  }

  const base = tenantRaw as unknown as TenantContext['tenant'];

  // The brand bucket is private, so the stored URL 403s in every <img> that
  // consumes it. Sign here — the one place every tenant surface passes through.
  const [brandLogoUrl, logoUrl] = await Promise.all([
    signBrandLogoUrl(base.brand_logo_url),
    signBrandLogoUrl(base.logo_url),
  ]);

  const tenant: TenantContext['tenant'] = {
    ...base,
    brand_logo_url: brandLogoUrl,
    logo_url: logoUrl,
  };

  return { tenant, companyId: tenantId };
});

export async function requireTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new Error('Tenant not found');
  return ctx;
}

export async function requireAdminSession() {
  const session = await getCachedSession();
  if (!session) throw new Error('Unauthorized: not authenticated');
  const role = (session.user as SessionUser).role;
  if (role !== 'super_admin') throw new Error('Unauthorized: admin access required');
  return session;
}

/**
 * Lightweight tenant scope check — uses cached session + memoized tenant context.
 * Skips redundant DB round-trips when proxy already stamped x-company-id.
 */
export async function assertTenantScope(companyId: string): Promise<string> {
  const session = await getCachedSession();
  if (!session) throw new Error('Unauthorized: not authenticated');

  const user = session.user as SessionUser;

  if (user.role !== 'super_admin' && user.tenantId !== companyId) {
    throw new Error(
      `Forbidden: tenant mismatch (expected=${user.tenantId}, got=${companyId})`,
    );
  }

  const ctx = await getTenantContext();
  if (!ctx || ctx.companyId !== companyId) {
    throw new Error('Forbidden: tenant scope mismatch');
  }

  return companyId;
}

/**
 * Defense-in-depth for server actions:
 * Validates that the companyId passed by the client matches the caller's session tenant.
 */
export async function requireTenantAction(companyId: string): Promise<string> {
  return assertTenantScope(companyId);
}
