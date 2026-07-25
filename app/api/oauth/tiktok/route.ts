import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { randomBytes } from 'crypto';
import type { SessionUser } from '@/types/user';
import type { OAuthState } from '@/features/oauth/types';
import { signOAuthState } from '@/lib/auth/oauth-state';
import { getOAuthBaseUrl } from '@/lib/utils/app-url';
import { getRequestOrigin } from '@/lib/utils/request-origin';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const user   = session.user as SessionUser;
  const appId  = process.env.TIKTOK_APP_ID;
  const appUrl   = getOAuthBaseUrl();

  if (!appId) {
    return NextResponse.json(
      { error: 'TIKTOK_APP_ID not configured.' },
      { status: 503 }
    );
  }

  const state: OAuthState = {
    tenantId: user.tenantId,
    returnTo: '/dashboard?magic=1',
    csrf:     randomBytes(16).toString('hex'),
    origin:   getRequestOrigin(req),
  };

  const params = new URLSearchParams({
    app_id:       appId,
    redirect_uri: `${appUrl}/api/oauth/tiktok/callback`,
    state:        signOAuthState(state),
    scope:        'campaign.list,adgroup.list,ad.list,report.list',
  });

  return NextResponse.redirect(
    `https://ads.tiktok.com/marketing_api/auth?${params.toString()}`
  );
}
