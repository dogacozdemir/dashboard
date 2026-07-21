import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { randomBytes } from 'crypto';
import type { SessionUser } from '@/types/user';
import type { OAuthState } from '@/features/oauth/types';
import { signOAuthState } from '@/lib/auth/oauth-state';
import { getAppUrl } from '@/lib/utils/app-url';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const user     = session.user as SessionUser;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const appUrl   = getAppUrl();

  if (!clientId) {
    return NextResponse.json(
      { error: 'GOOGLE_ADS_CLIENT_ID not configured.' },
      { status: 503 }
    );
  }

  const state: OAuthState = {
    tenantId: user.tenantId,
    returnTo: '/dashboard?magic=1',
    csrf:     randomBytes(16).toString('hex'),
  };

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  `${appUrl}/api/oauth/google/callback`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ].join(' '),
    access_type:   'offline',
    prompt:        'consent',
    state:         signOAuthState(state),
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
