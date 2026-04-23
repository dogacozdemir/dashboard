import { headers } from 'next/headers';
import { auth } from './config';
import { getTenantBySlug } from '@/lib/supabase/server';
import type { TenantContext } from '@/types/tenant';
import type { SessionUser } from '@/types/user';

export async function getTenantContext(): Promise<TenantContext | null> {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug');

  if (!tenantSlug || tenantSlug === 'www' || tenantSlug === 'admin') return null;

  const tenantRaw = await getTenantBySlug(tenantSlug);
  if (!tenantRaw) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = tenantRaw as any;
  return { tenant, companyId: tenant.id };
}

export async function requireTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new Error('Tenant not found');
  return ctx;
}

export async function requireAdminSession() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized: not authenticated');
  const role = (session.user as SessionUser).role;
  if (role !== 'admin') throw new Error('Unauthorized: admin access required');
  return session;
}

/**
 * Defense-in-depth for server actions:
 * Validates that the companyId passed by the client matches the caller's session tenant.
 * Prevents IDOR attacks where a compromised client passes another tenant's ID.
 */
export async function requireTenantAction(companyId: string): Promise<string> {
  const session = await auth();
  if (!session) throw new Error('Unauthorized: not authenticated');

  const user = session.user as SessionUser;

  // Admins can act on any tenant
  if (user.role === 'admin') return companyId;

  // For non-admins, companyId MUST match their own tenantId from the JWT
  if (user.tenantId !== companyId) {
    throw new Error(
      `Forbidden: tenant mismatch (expected=${user.tenantId}, got=${companyId})`
    );
  }

  return companyId;
}
