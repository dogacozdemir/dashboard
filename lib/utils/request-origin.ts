import type { NextRequest } from 'next/server';

/**
 * Build the real request origin from Host headers.
 * NextAuth may rewrite `request.url` to NEXTAUTH_URL — never use that for tenant redirects.
 */
export function getRequestOrigin(request: NextRequest): string {
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    request.headers.get('host') ??
    '';

  if (!host) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const hostname = host.split(':')[0].toLowerCase();
  const protocol =
    forwardedProto ??
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.lvh.me')
      ? 'http'
      : 'https');

  return `${protocol}://${host}`;
}

export function absoluteUrl(request: NextRequest, path: string): URL {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, getRequestOrigin(request));
}
