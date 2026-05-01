/**
 * Dashboard URL for a tenant after impersonation cookie is set.
 * Local dev: same origin (middleware reads cookie). Production: subdomain.
 */
export function getTenantDashboardUrl(tenantSlug: string, path = '/dashboard'): string {
  const raw = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';
  const [hostPart, portPart] = raw.includes(':') ? raw.split(':') : [raw, ''];
  const port = portPart ? `:${portPart}` : '';
  const isLocal = hostPart === 'localhost' || hostPart === '127.0.0.1';
  const protocol = isLocal ? 'http' : 'https';

  if (isLocal) {
    return `${protocol}://${hostPart}${port}${path}`;
  }

  return `${protocol}://${tenantSlug}.${hostPart}${path}`;
}

/** Super-admin control center (tenant list). */
export function getAdminTenantsUrl(): string {
  const raw = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';
  const [hostPart, portPart] = raw.includes(':') ? raw.split(':') : [raw, ''];
  const port = portPart ? `:${portPart}` : '';
  const isLocal = hostPart === 'localhost' || hostPart === '127.0.0.1';
  const protocol = isLocal ? 'http' : 'https';

  if (isLocal) {
    return `${protocol}://admin.${hostPart}${port}/tenants`;
  }

  return `${protocol}://admin.${hostPart}/tenants`;
}

/** Super-admin Role Architect (admin host). */
export function getAdminRolesUrl(): string {
  const raw = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';
  const [hostPart, portPart] = raw.includes(':') ? raw.split(':') : [raw, ''];
  const port = portPart ? `:${portPart}` : '';
  const isLocal = hostPart === 'localhost' || hostPart === '127.0.0.1';
  const protocol = isLocal ? 'http' : 'https';

  if (isLocal) {
    return `${protocol}://admin.${hostPart}${port}/roles`;
  }

  return `${protocol}://admin.${hostPart}/roles`;
}
