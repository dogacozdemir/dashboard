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
