import { NextResponse } from 'next/server';

/** Append ?connected= or &connected= to returnTo and redirect (supports returnTo with existing query e.g. /dashboard?magic=1). */
export function oauthSuccessRedirect(appUrl: string, returnTo: string, connected: string): NextResponse {
  const path = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
  const sep = path.includes('?') ? '&' : '?';
  const url = `${appUrl}${path}${sep}connected=${encodeURIComponent(connected)}`;
  return NextResponse.redirect(url);
}
