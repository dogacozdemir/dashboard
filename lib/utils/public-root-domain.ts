/**
 * Canonical public host for tenant subdomains (local: lvh.me:3000, prod: madmonos.example.com).
 * Tenants resolve as `{slug}.{host}` without port; port is appended when building URLs.
 */
export function getPublicRootDomainParts(): { host: string; port: string } {
  const raw = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'lvh.me:3000').trim().toLowerCase();
  const colon = raw.lastIndexOf(':');
  if (colon > -1 && /^\d+$/.test(raw.slice(colon + 1))) {
    return { host: raw.slice(0, colon), port: raw.slice(colon) };
  }
  return { host: raw, port: '' };
}
