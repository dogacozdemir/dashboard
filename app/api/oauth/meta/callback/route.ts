import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken, packToken } from '@/lib/utils/crypto';
import { syncAdPlatform } from '@/features/oauth/actions/syncPlatformData';
import { verifyOAuthState } from '@/lib/auth/oauth-state';
import { auth } from '@/lib/auth/config';
import type { SessionUser } from '@/types/user';
import { oauthSuccessRedirect } from '@/features/oauth/lib/oauthRedirect';
import { getAppUrl, getOAuthBaseUrl, sanitizeTenantOrigin } from '@/lib/utils/app-url';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code      = searchParams.get('code');
  const stateB64  = searchParams.get('state');
  const oauthBase = getOAuthBaseUrl();
  const state     = verifyOAuthState(stateB64);
  // User-facing redirects go back to the tenant subdomain the flow started on;
  // the fixed OAuth host only exists so the registered redirect_uri is stable.
  const appUrl    = sanitizeTenantOrigin(state?.origin) ?? getAppUrl();

  if (!code || !stateB64) {
    return NextResponse.redirect(`${appUrl}/performance?error=oauth_failed`);
  }

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

  const appId     = process.env.META_APP_ID ?? '';
  const appSecret = process.env.META_APP_SECRET ?? '';

  // Exchange code for token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&redirect_uri=${oauthBase}/api/oauth/meta/callback` +
      `&code=${code}`
  );

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/performance?error=token_exchange_failed`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
  };

  // Encrypt and store the token
  const { tenantId } = state;
  const encrypted = encryptToken(tokenData.access_token);
  const packed    = packToken(encrypted);
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const supabase = await createSupabaseServerClient();
  await supabase.from('ad_accounts').upsert(
    {
      tenant_id:        tenantId,
      platform:         'meta',
      account_id:       `meta_${tenantId}`,
      account_name:     'Meta Ads',
      access_token:     packed,
      iv:               encrypted.iv,
      token_expires_at: expiresAt,
      is_active:        true,
    },
    { onConflict: 'tenant_id,platform,account_id' }
  );

  // Trigger background sync (non-blocking)
  syncAdPlatform(tenantId, 'meta').catch((err) =>
    console.error('[meta-callback] sync error', err)
  );

  return oauthSuccessRedirect(appUrl, state.returnTo, 'meta');
}
