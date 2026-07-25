import { getPublicRootDomainParts, inferRootHostFromHostname } from '@/lib/utils/public-root-domain';

/**
 * Base URL used to build OAuth `redirect_uri` values.
 *
 * These must match what's registered with Google/Meta/TikTok exactly. Falling
 * straight through to localhost silently breaks every connect flow in
 * production, so `NEXT_PUBLIC_SITE_URL` is honoured before that last resort.
 */
export function getAppUrl(): string {
  const raw = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/**
 * Fixed host registered with the OAuth providers, e.g. `https://app.madmonos.com`.
 *
 * The apex domain serves the corporate website (a separate deployment), so the
 * app's OAuth callbacks live on a dedicated stable subdomain instead. Set
 * `OAUTH_REDIRECT_BASE` to that subdomain; without it, `getAppUrl()` is used.
 */
export function getOAuthBaseUrl(): string {
  const raw = process.env.OAUTH_REDIRECT_BASE?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  return getAppUrl();
}

/**
 * Validates the tenant origin carried in signed OAuth state so the callback can
 * send the user back to the subdomain they started from. Anything outside the
 * public root domain is rejected (open-redirect guard) — the value rides in a
 * signed payload, but defense-in-depth costs nothing.
 */
export function sanitizeTenantOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    const hostname = u.hostname.toLowerCase();
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'lvh.me' ||
      hostname.endsWith('.lvh.me');
    if (isLocal) return u.origin;

    if (u.protocol !== 'https:') return null;
    const envRoot = getPublicRootDomainParts().host;
    const root = envRoot && envRoot !== 'lvh.me' ? envRoot : inferRootHostFromHostname(hostname);
    if (hostname !== root && !hostname.endsWith(`.${root}`)) return null;
    return u.origin;
  } catch {
    return null;
  }
}
