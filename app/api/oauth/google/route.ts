import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { randomBytes } from 'crypto';
import type { SessionUser } from '@/types/user';
import type { OAuthState } from '@/features/oauth/types';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const user     = session.user as SessionUser;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const appUrl   = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  if (!clientId) {
    return NextResponse.json(
      { error: 'GOOGLE_ADS_CLIENT_ID not configured.' },
      { status: 503 }
    );
  }

  const state: OAuthState = {
    tenantId: user.tenantId,
    returnTo: '/performance',
    csrf:     randomBytes(16).toString('hex'),
  };

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  `${appUrl}/api/oauth/google/callback`,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/adwords',
    access_type:   'offline',
    prompt:        'consent',
    state:         Buffer.from(JSON.stringify(state)).toString('base64url'),
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
