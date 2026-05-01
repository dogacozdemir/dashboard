import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken, packToken } from '@/lib/utils/crypto';
import { syncAdPlatform } from '@/features/oauth/actions/syncPlatformData';
import type { OAuthState } from '@/features/oauth/types';
import { oauthSuccessRedirect } from '@/features/oauth/lib/oauthRedirect';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const authCode  = searchParams.get('auth_code');
  const stateB64  = searchParams.get('state');
  const appUrl    = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  if (!authCode || !stateB64) {
    return NextResponse.redirect(`${appUrl}/performance?error=oauth_failed`);
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(stateB64, 'base64url').toString()) as OAuthState;
  } catch {
    return NextResponse.redirect(`${appUrl}/performance?error=invalid_state`);
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

  const { data: ttData } = (await tokenRes.json()) as {
    data: { access_token: string; refresh_token?: string; expires_in?: number };
  };

  const { tenantId } = state;
  const encAccess = encryptToken(ttData.access_token);

  const supabase = await createSupabaseServerClient();
  await supabase.from('ad_accounts').upsert(
    {
      tenant_id:    tenantId,
      platform:     'tiktok',
      account_id:   `tiktok_${tenantId}`,
      account_name: 'TikTok Ads',
      access_token: packToken(encAccess),
      iv:           encAccess.iv,
      is_active:    true,
    },
    { onConflict: 'tenant_id,platform,account_id' }
  );

  syncAdPlatform(tenantId, 'tiktok').catch((err) =>
    console.error('[tiktok-callback] sync error', err)
  );

  return oauthSuccessRedirect(appUrl, state.returnTo, 'tiktok');
}
