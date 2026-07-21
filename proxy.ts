import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  IMPERSONATE_TENANT_COOKIE,
  IMPERSONATE_TENANT_ID_COOKIE,
} from '@/lib/auth/constants';
import { resolveTenantIdBySlug } from '@/lib/auth/resolve-tenant-id';
import { isScopedTenantHostSlug, parseTenantSlugFromHost } from '@/lib/utils/parse-tenant-host';
import { absoluteUrl } from '@/lib/utils/request-origin';
import type { SessionUser } from '@/types/user';

// `/api/cron/*` gates itself on a CRON_SECRET bearer token. Schedulers send that
// header and no session cookie, so leaving it behind the session check redirects
// every scheduled run to /login — the job silently never executes.
const PUBLIC_PATHS = ['/login', '/set-password', '/api/auth', '/api/cron', '/_next', '/manifest.json', '/not-found', '/unauthorized'];
const PUBLIC_ASSET_PATHS = new Set([
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/madmonos-logo.png',
  '/madmonos-logo-optimized.png',
  // PWA shell. A service worker script served via redirect is rejected outright
  // by the browser, which silently kills offline support and push notifications.
  '/sw.js',
  '/offline.html',
  '/manifest.json',
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isLocalDevHost(subdomain: string): boolean {
  return subdomain === 'localhost' || subdomain === '127.0.0.1';
}

function sanitizeCallbackUrl(raw: string | null, origin: string): string {
  if (!raw) return '/dashboard';
  try {
    const base = new URL(origin);
    const cb = new URL(raw, base.origin);
    if (cb.origin !== base.origin) return '/dashboard';
    return cb.pathname + cb.search;
  } catch {
    return '/dashboard';
  }
}

/**
 * Multi-tenant proxy.
 * - Tenant scope from Host subdomain (retroline.madmonos.com → retroline)
 * - Redirects preserve the incoming Host (never NEXTAUTH_URL / nerdyreptile)
 * - Super-admin impersonation via cookies
 */
export default auth(async (request) => {
  const pathname = request.nextUrl.pathname;
  const session = request.auth;
  const origin = absoluteUrl(request, '/').origin;

  if (pathname === '/favicon.ico') {
    return NextResponse.rewrite(absoluteUrl(request, '/favicon-32x32.png'));
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
  const subdomain = parseTenantSlugFromHost(host);

  if (pathname === '/' && subdomain !== 'admin') {
    return NextResponse.redirect(absoluteUrl(request, '/dashboard'));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', subdomain);
  requestHeaders.set('x-pathname', pathname);

  if (pathname === '/login' && session) {
    return NextResponse.redirect(absoluteUrl(request, '/dashboard'));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!session) {
    const loginUrl = absoluteUrl(request, '/login');
    const safeCallback = sanitizeCallbackUrl(
      request.nextUrl.pathname + request.nextUrl.search,
      origin,
    );
    loginUrl.searchParams.set('callbackUrl', safeCallback);
    return NextResponse.redirect(loginUrl);
  }

  if (subdomain === 'admin') {
    const role = (session.user as SessionUser).role;
    if (role !== 'super_admin') {
      return NextResponse.redirect(absoluteUrl(request, '/unauthorized'));
    }
  }

  const sessionUser = (session.user ?? {}) as Partial<SessionUser>;
  const impersonateSlug = request.cookies.get(IMPERSONATE_TENANT_COOKIE)?.value?.trim().toLowerCase() ?? '';
  const impersonateTenantId = request.cookies.get(IMPERSONATE_TENANT_ID_COOKIE)?.value?.trim() ?? '';

  let effectiveSlug = subdomain;

  if (isScopedTenantHostSlug(subdomain)) {
    effectiveSlug = subdomain;
  } else if (sessionUser.role === 'super_admin' && impersonateSlug) {
    effectiveSlug = impersonateSlug;
  } else if (isLocalDevHost(subdomain) && sessionUser.tenantSlug) {
    effectiveSlug = sessionUser.tenantSlug;
  }

  requestHeaders.set('x-tenant-slug', effectiveSlug);

  if (isScopedTenantHostSlug(effectiveSlug)) {
    let scopedCompanyId: string | null = null;

    if (
      sessionUser.role === 'super_admin' &&
      impersonateSlug === effectiveSlug &&
      impersonateTenantId
    ) {
      scopedCompanyId = impersonateTenantId;
    } else {
      scopedCompanyId = await resolveTenantIdBySlug(effectiveSlug);
    }

    requestHeaders.set('x-company-id', scopedCompanyId ?? '');
  } else {
    requestHeaders.set('x-company-id', sessionUser.tenantId ?? '');
  }

  requestHeaders.set('x-user-role', sessionUser.role ?? '');

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    /*
     * Skip static assets, NextAuth, and lightweight API routes that only need
     * route-handler auth (no subdomain tenant stamping).
     */
    '/((?!_next/static|_next/image|favicon\\.ico|favicon-16x16\\.png|favicon-32x32\\.png|apple-touch-icon\\.png|icon-192\\.png|icon-512\\.png|madmonos-logo\\.png|madmonos-logo-optimized\\.png|manifest\\.json|sw\\.js|offline\\.html|api/auth|api/cron|api/realtime-token).*)',
  ],
};
