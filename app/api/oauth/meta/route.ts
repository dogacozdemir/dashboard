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

  const user       = session.user as SessionUser;
  const tenantId   = user.tenantId;
  const appId      = process.env.META_APP_ID;
  const appUrl     = getAppUrl();

  if (!appId) {
    return NextResponse.json(
      { error: 'META_APP_ID not configured. Add it to your .env.local file.' },
      { status: 503 }
    );
  }

  const state: OAuthState = {
    tenantId,
    returnTo: '/dashboard?magic=1',
    csrf:     randomBytes(16).toString('hex'),
  };

  const params = new URLSearchParams({
    client_id:     appId,
    redirect_uri:  `${appUrl}/api/oauth/meta/callback`,
    scope:         'ads_read,ads_management,business_management,instagram_basic,pages_read_engagement',
    response_type: 'code',
    state:         signOAuthState(state),
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  );
}
