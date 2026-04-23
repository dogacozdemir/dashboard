import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken, packToken } from '@/lib/utils/crypto';
import { syncAdPlatform } from '@/features/oauth/actions/syncPlatformData';
import type { OAuthState } from '@/features/oauth/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code     = searchParams.get('code');
  const stateB64 = searchParams.get('state');
  const appUrl   = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  if (!code || !stateB64) {
    return NextResponse.redirect(`${appUrl}/performance?error=oauth_failed`);
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(stateB64, 'base64url').toString()) as OAuthState;
  } catch {
    return NextResponse.redirect(`${appUrl}/performance?error=invalid_state`);
  }

  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? '';

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  `${appUrl}/api/oauth/google/callback`,
      grant_type:    'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/performance?error=token_exchange_failed`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const { tenantId } = state;
  const encAccess  = encryptToken(tokenData.access_token);
  const encRefresh = tokenData.refresh_token ? packToken(encryptToken(tokenData.refresh_token)) : null;

  const supabase = await createSupabaseServerClient();
  await supabase.from('ad_accounts').upsert(
    {
      tenant_id:        tenantId,
      platform:         'google',
      account_id:       `google_${tenantId}`,
      account_name:     'Google Ads',
      access_token:     packToken(encAccess),
      refresh_token:    encRefresh,
      iv:               encAccess.iv,
      token_expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
      is_active: true,
    },
    { onConflict: 'tenant_id,platform,account_id' }
  );

  syncAdPlatform(tenantId, 'google').catch((err) =>
    console.error('[google-callback] sync error', err)
  );

  return NextResponse.redirect(`${appUrl}${state.returnTo}?connected=google`);
}
