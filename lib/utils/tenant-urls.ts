import {
  getEffectivePublicRootDomainParts,
  getPublicRootDomainParts,
  getRootDomainPartsFromHost,
} from '@/lib/utils/public-root-domain';

function tenantProtocol(hostPart: string): 'http' | 'https' {
  return hostPart === 'localhost' || hostPart === '127.0.0.1' || hostPart.endsWith('.lvh.me')
    ? 'http'
    : 'https';
}

function resolveRootParts(hostHeader?: string): { host: string; port: string } {
  if (typeof window !== 'undefined') {
    return getEffectivePublicRootDomainParts();
  }
  if (hostHeader?.trim()) {
    return getRootDomainPartsFromHost(hostHeader);
  }
  return getPublicRootDomainParts();
}

/** Tenant dashboard URL — `{slug}.madmonos.com` in prod, `{slug}.lvh.me:3000` locally. */
export function getTenantDashboardUrl(
  tenantSlug: string,
  path = '/dashboard',
  hostHeader?: string,
): string {
  const { host, port } = resolveRootParts(hostHeader);
  const protocol = tenantProtocol(host);
  return `${protocol}://${tenantSlug}.${host}${port}${path}`;
}

/** Super-admin tenant registry */
export function getAdminTenantsUrl(hostHeader?: string): string {
  const { host, port } = resolveRootParts(hostHeader);
  const protocol = tenantProtocol(host);
  return `${protocol}://admin.${host}${port}/tenants`;
}

/** Super-admin Role Architect */
export function getAdminRolesUrl(hostHeader?: string): string {
  const { host, port } = resolveRootParts(hostHeader);
  const protocol = tenantProtocol(host);
  return `${protocol}://admin.${host}${port}/roles`;
}
