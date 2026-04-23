import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';

const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon.ico', '/not-found', '/unauthorized'];

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

export default async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const subdomain = parseSubdomain(host);
  const pathname = request.nextUrl.pathname;

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
    const role = (session.user as { role?: string }).role;
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Inject tenant context headers for RSCs
  // session.user can be undefined if AUTH_SECRET is missing or JWT is malformed
  const sessionUser = (session?.user ?? {}) as { tenantId?: string; tenantSlug?: string; role?: string };
  // Local dev has no real subdomain. Use session tenant slug instead of "localhost".
  if (isLocalDevHost(subdomain) && sessionUser.tenantSlug) {
    requestHeaders.set('x-tenant-slug', sessionUser.tenantSlug);
  }
  requestHeaders.set('x-company-id', sessionUser.tenantId ?? '');
  requestHeaders.set('x-user-role', sessionUser.role ?? '');

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
