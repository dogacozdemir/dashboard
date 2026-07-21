import { getTenantDashboardUrl } from '@/lib/utils/tenant-urls';

/**
 * Super-admin: set impersonation cookies (best-effort) then navigate to tenant subdomain.
 * Navigation always proceeds — tenant scope is enforced by subdomain in proxy.ts.
 */
export async function navigateToTenantAsCustomer(
  slug: string,
  path = '/dashboard',
): Promise<void> {
  const normalized = slug.trim().toLowerCase();
  const targetPath = path.startsWith('/') ? path : `/${path}`;

  try {
    await fetch('/api/admin/impersonate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: normalized }),
    });
  } catch {
    /* cookie optional — subdomain defines tenant scope */
  }

  window.location.href = getTenantDashboardUrl(normalized, targetPath);
}
