import { NextRequest, NextResponse } from 'next/server';

/**
 * ROOT_DOMAIN examples:
 *   - Production:  madmonos.nerdyreptile.com
 *   - Local dev:   localhost:3000
 *
 * Tenant subdomains live one level above this root:
 *   acme.madmonos.nerdyreptile.com  →  x-tenant-slug: acme
 *   admin.madmonos.nerdyreptile.com →  x-tenant-slug: admin
 *   madmonos.nerdyreptile.com       →  x-tenant-slug: localhost (layout falls back to JWT tenantSlug)
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';

  let subdomain = 'localhost';

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    // e.g. "acme.madmonos.nerdyreptile.com" → "acme"
    subdomain = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  }
  // else: root domain itself or localhost → keep "localhost"
  // the tenant layout handles "localhost" by reading user.tenantSlug from the JWT

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', subdomain);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimisation)
     * - public icons / manifest (avoids header injection overhead for static files)
     * - api/auth      (NextAuth endpoints must stay untouched)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon-.*\\.png|manifest\\.json|api/auth).*)',
  ],
};
