import {
  getRootDomainPartsFromHost,
  inferRootHostFromHostname,
} from '@/lib/utils/public-root-domain';

/** Extract tenant/admin segment from Host header (e.g. retroline.madmonos.com → retroline). */
export function parseTenantSlugFromHost(host: string): string {
  const withoutPort = host.split(':')[0].toLowerCase();
  const rootHost = getRootDomainPartsFromHost(host).host;

  if (withoutPort === rootHost || withoutPort === 'localhost' || withoutPort === '127.0.0.1') {
    return 'localhost';
  }

  if (withoutPort.endsWith(`.${rootHost}`)) {
    const slug = withoutPort.slice(0, -(rootHost.length + 1));
    // Single-label subdomain only (retroline, admin — not nested)
    if (slug && !slug.includes('.')) {
      return slug;
    }
  }

  // Fallback: infer from hostname structure even if env was wrong
  const inferredRoot = inferRootHostFromHostname(withoutPort);
  if (withoutPort.endsWith(`.${inferredRoot}`)) {
    const slug = withoutPort.slice(0, -(inferredRoot.length + 1));
    if (slug && !slug.includes('.')) {
      return slug;
    }
  }

  return 'localhost';
}

/** True when host maps to a real tenant workspace (not admin / apex / local).
 *  `app` and `api` are reserved for the fixed OAuth/callback host — a session
 *  landing there resolves to the user's own tenant, not a tenant named "app". */
export function isScopedTenantHostSlug(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  return Boolean(
    s &&
      s !== 'admin' &&
      s !== 'www' &&
      s !== 'app' &&
      s !== 'api' &&
      s !== 'localhost' &&
      s !== '127.0.0.1',
  );
}
