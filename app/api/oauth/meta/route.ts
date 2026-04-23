import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { randomBytes } from 'crypto';
import type { SessionUser } from '@/types/user';
import type { OAuthState } from '@/features/oauth/types';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const user       = session.user as SessionUser;
  const tenantId   = user.tenantId;
  const appId      = process.env.META_APP_ID;
  const appUrl     = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  if (!appId) {
    return NextResponse.json(
      { error: 'META_APP_ID not configured. Add it to your .env.local file.' },
      { status: 503 }
    );
  }

  const state: OAuthState = {
    tenantId,
    returnTo: '/performance',
    csrf:     randomBytes(16).toString('hex'),
  };

  const params = new URLSearchParams({
    client_id:     appId,
    redirect_uri:  `${appUrl}/api/oauth/meta/callback`,
    scope:         'ads_read,ads_management,business_management',
    response_type: 'code',
    state:         Buffer.from(JSON.stringify(state)).toString('base64url'),
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  );
}
