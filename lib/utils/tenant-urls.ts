import { getPublicRootDomainParts } from '@/lib/utils/public-root-domain';

function tenantProtocol(hostPart: string): 'http' | 'https' {
  return hostPart === 'localhost' || hostPart === '127.0.0.1' || hostPart.endsWith('.lvh.me')
    ? 'http'
    : 'https';
}

/** Tenant dashboard URL — always subdomain `{slug}.{root}` (local: https? — http for lvh.me / localhost). */
export function getTenantDashboardUrl(tenantSlug: string, path = '/dashboard'): string {
  const { host, port } = getPublicRootDomainParts();
  const protocol = tenantProtocol(host);
  return `${protocol}://${tenantSlug}.${host}${port}${path}`;
}

/** Super-admin tenant registry */
export function getAdminTenantsUrl(): string {
  const { host, port } = getPublicRootDomainParts();
  const protocol = tenantProtocol(host);
  return `${protocol}://admin.${host}${port}/tenants`;
}

/** Super-admin Role Architect */
export function getAdminRolesUrl(): string {
  const { host, port } = getPublicRootDomainParts();
  const protocol = tenantProtocol(host);
  return `${protocol}://admin.${host}${port}/roles`;
}
