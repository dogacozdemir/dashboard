import { getPublicRootDomainParts } from '@/lib/utils/public-root-domain';

function isLocalRootHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === 'lvh.me' ||
    h.endsWith('.lvh.me')
  );
}

/** Secure flag only when served over HTTPS in real production — not `npm start` on localhost. */
export function shouldUseSecureAuthCookies(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;

  const { host } = getPublicRootDomainParts();
  if (isLocalRootHost(host)) return false;

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

  const { host } = getPublicRootDomainParts();

  if (isLocalRootHost(host) || host.includes('nerdyreptile')) {
    return undefined;
  }

  return `.${host}`;
}
