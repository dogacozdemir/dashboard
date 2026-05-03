import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { IMPERSONATE_TENANT_COOKIE } from '@/lib/auth/constants';
import type { SessionUser } from '@/types/user';

const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/manifest.json', '/not-found', '/unauthorized'];
const PUBLIC_ASSET_PATHS = new Set([
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/madmonos-logo.png',
  '/madmonos-logo-optimized.png',
]);

// e.g. "madmonos.nerdyreptile.com" — must be set in .env.local on the server
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000').split(':')[0];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Extracts the tenant slug from the hostname.
 *
 * Examples (ROOT_DOMAIN = madmonos.nerdyreptile.com):
 *   acme.madmonos.nerdyreptile.com  →  "acme"
 *   admin.madmonos.nerdyreptile.com →  "admin"
 *   madmonos.nerdyreptile.com       →  "localhost"  (root domain → fall back to JWT tenantSlug)
 *   localhost                       →  "localhost"
 */
function parseSubdomain(host: string): string {
  const withoutPort = host.split(':')[0];

  if (withoutPort.endsWith(`.${ROOT_DOMAIN}`)) {
    return withoutPort.slice(0, -(ROOT_DOMAIN.length + 1));
  }

  // Host IS the root domain itself, or localhost → treat as local dev
  return 'localhost';
}

function isLocalDevHost(subdomain: string): boolean {
  return subdomain === 'localhost' || subdomain === '127.0.0.1';
}

/**
 * Validates callbackUrl is a same-origin relative path.
 * Prevents open-redirect attacks where attacker sets callbackUrl=https://evil.com
 */
function sanitizeCallbackUrl(raw: string | null, requestUrl: string): string {
  if (!raw) return '/dashboard';
  try {
    const base = new URL(requestUrl);
    const cb = new URL(raw, base.origin);
    // Only allow same origin
    if (cb.origin !== base.origin) return '/dashboard';
    return cb.pathname + cb.search;
  } catch {
    return '/dashboard';
  }
}

/** Next.js 16+ request proxy (replaces deprecated middleware). No `export const config` here — matcher logic is inlined. */
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/favicon.ico') {
    // Force browser tab favicon to use branded icon asset.
    return NextResponse.rewrite(new URL('/favicon-32x32.png', request.url));
  }

  if (
    PUBLIC_ASSET_PATHS.has(pathname) ||
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const host = request.headers.get('host') ?? '';
  const subdomain = parseSubdomain(host);

  // Tenant hosts must not serve `/` as the admin shell route — only `admin.*` uses `(admin)/page.tsx` at `/`.
  if (pathname === '/' && subdomain !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', subdomain);
  requestHeaders.set('x-pathname', pathname);

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Auth check with error boundary
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error('[proxy] auth() error:', err);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    const safeCallback = sanitizeCallbackUrl(request.url, request.url);
    loginUrl.searchParams.set('callbackUrl', safeCallback);
    return NextResponse.redirect(loginUrl);
  }

  // Admin subdomain guard
  if (subdomain === 'admin') {
    const role = (session.user as SessionUser).role;
    if (role !== 'super_admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Inject tenant context headers for RSCs
  // session.user can be undefined if AUTH_SECRET is missing or JWT is malformed
  const sessionUser = (session?.user ?? {}) as Partial<SessionUser>;
  const impersonateSlug = request.cookies.get(IMPERSONATE_TENANT_COOKIE)?.value?.trim() ?? '';

  if (subdomain !== 'admin' && sessionUser.role === 'super_admin' && impersonateSlug) {
    requestHeaders.set('x-tenant-slug', impersonateSlug);
  } else if (isLocalDevHost(subdomain) && sessionUser.tenantSlug) {
    // Local dev has no real subdomain. Use session tenant slug instead of "localhost".
    requestHeaders.set('x-tenant-slug', sessionUser.tenantSlug);
  }
  requestHeaders.set('x-company-id', sessionUser.tenantId ?? '');
  requestHeaders.set('x-user-role', sessionUser.role ?? '');

  return NextResponse.next({ request: { headers: requestHeaders } });
}
