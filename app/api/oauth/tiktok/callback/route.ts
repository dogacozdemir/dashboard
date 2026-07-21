import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken, packToken } from '@/lib/utils/crypto';
import { syncAdPlatform } from '@/features/oauth/actions/syncPlatformData';
import { verifyOAuthState } from '@/lib/auth/oauth-state';
import { auth } from '@/lib/auth/config';
import type { SessionUser } from '@/types/user';
import { oauthSuccessRedirect } from '@/features/oauth/lib/oauthRedirect';
import { getAppUrl } from '@/lib/utils/app-url';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const authCode  = searchParams.get('auth_code');
  const stateB64  = searchParams.get('state');
  const appUrl    = getAppUrl();

  if (!authCode || !stateB64) {
    return NextResponse.redirect(`${appUrl}/performance?error=oauth_failed`);
  }

  const state = verifyOAuthState(stateB64);
  if (!state) {
    return NextResponse.redirect(`${appUrl}/performance?error=invalid_state`);
  }

  // Defense-in-depth: only a logged-in member of the target tenant may complete the connection.
  const session     = await auth();
  const sessionUser = session?.user as SessionUser | undefined;
  if (!sessionUser) {
    return NextResponse.redirect(`${appUrl}/login`);
  }
  if (sessionUser.role !== 'super_admin' && sessionUser.tenantId !== state.tenantId) {
    return NextResponse.redirect(`${appUrl}/unauthorized`);
  }

  const appId     = process.env.TIKTOK_APP_ID ?? '';
  const appSecret = process.env.TIKTOK_APP_SECRET ?? '';

  const tokenRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id:    appId,
      secret:    appSecret,
      auth_code: authCode,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/performance?error=token_exchange_failed`);
  }

  // TikTok returns HTTP 200 even on failure; the real status is `code` (0 = success).
  const tokenJson = (await tokenRes.json()) as {
    code?: number;
    message?: string;
    data?: { access_token?: string; refresh_token?: string; expires_in?: number };
  };
  const ttData = tokenJson.data;
  if ((tokenJson.code != null && tokenJson.code !== 0) || !ttData?.access_token) {
    console.error('[tiktok-callback] token error', tokenJson.code, tokenJson.message);
    return NextResponse.redirect(`${appUrl}/performance?error=token_exchange_failed`);
  }

  const { tenantId } = state;
  const encAccess = encryptToken(ttData.access_token);
  const encRefresh = ttData.refresh_token ? packToken(encryptToken(ttData.refresh_token)) : null;

  const supabase = await createSupabaseServerClient();
  await supabase.from('ad_accounts').upsert(
    {
      tenant_id:    tenantId,
      platform:     'tiktok',
      account_id:   `tiktok_${tenantId}`,
      account_name: 'TikTok Ads',
      access_token: packToken(encAccess),
      refresh_token: encRefresh,
      iv:           encAccess.iv,
      token_expires_at: ttData.expires_in
        ? new Date(Date.now() + ttData.expires_in * 1000).toISOString()
        : null,
      is_active:    true,
    },
    { onConflict: 'tenant_id,platform,account_id' }
  );

  syncAdPlatform(tenantId, 'tiktok').catch((err) =>
    console.error('[tiktok-callback] sync error', err)
  );

  return oauthSuccessRedirect(appUrl, state.returnTo, 'tiktok');
}
