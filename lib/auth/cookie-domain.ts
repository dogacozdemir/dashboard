import { getPublicRootDomainParts, inferRootHostFromHostname } from '@/lib/utils/public-root-domain';

function isLocalRootHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === 'lvh.me' ||
    h.endsWith('.lvh.me')
  );
}

/**
 * Registrable root domain derived from the configured auth/site URLs, e.g.
 * `https://app.madmonos.com` → `madmonos.com`.
 *
 * `NEXT_PUBLIC_ROOT_DOMAIN` is the intended source of truth, but it's a build-
 * time public var that's easy to forget in production — and when it's missing it
 * silently defaults to `lvh.me`, which makes the session cookie host-only. A
 * host-only cookie doesn't span subdomains, so the login is lost the moment the
 * OAuth round-trip passes through the fixed callback host. Deriving the domain
 * from `NEXTAUTH_URL` (which must be set for login to work at all) recovers the
 * correct shared cookie domain without a second env var.
 */
function rootDomainFromAuthUrls(): string | null {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.OAUTH_REDIRECT_BASE,
  ];
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      const { hostname } = new URL(trimmed);
      if (isLocalRootHost(hostname)) continue;
      const root = inferRootHostFromHostname(hostname);
      if (root && !isLocalRootHost(root) && root.includes('.')) return root;
    } catch {
      // Not a URL — ignore.
    }
  }
  return null;
}

/** Registrable root host for production, or null when only local hosts resolve. */
function effectiveRootHost(): string | null {
  const { host } = getPublicRootDomainParts();
  // A usable public root domain is non-empty, multi-label, and non-local. An
  // empty/blank NEXT_PUBLIC_ROOT_DOMAIN falls through to the auth-URL fallback.
  if (host && host.includes('.') && !isLocalRootHost(host)) return host;
  return rootDomainFromAuthUrls();
}

/** Secure flag only when served over HTTPS in real production — not `npm start` on localhost. */
export function shouldUseSecureAuthCookies(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;

  if (!effectiveRootHost()) return false;

  const explicit = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;

  const siteUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (siteUrl.startsWith('http://')) return false;

  return true;
}

/** Shared cookie domain for cross-subdomain auth (e.g. `.madmonos.com`). */
export function getSharedCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }

  const host = effectiveRootHost();
  return host ? `.${host}` : undefined;
}
