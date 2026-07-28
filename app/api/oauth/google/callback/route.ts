import { NextRequest, NextResponse } from 'next/server';
import { encryptToken, packToken } from '@/lib/utils/crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { runSyncAdPlatformForTenant, runSyncSEOForTenant } from '@/features/oauth/actions/syncPlatformData';
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

  // The signed `state` (HMAC over tenantId) is the authorization — not a session
  // cookie, which isn't reliably visible on the fixed OAuth callback host and,
  // when required there, silently dropped the connection at /login. A present
  // session still rejects a mismatched non-admin tenant as a bonus guard.
  const session     = await auth();
  const sessionUser = session?.user as SessionUser | undefined;
  if (sessionUser && sessionUser.role !== 'super_admin' && sessionUser.tenantId !== state.tenantId) {
    return NextResponse.redirect(`${appUrl}/unauthorized`);
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
      redirect_uri:  `${oauthBase}/api/oauth/google/callback`,
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

  // Admin client: the write must not depend on a request session, and its error
  // must be surfaced rather than swallowed.
  const supabase = createSupabaseAdminClient();
  const { error: upsertError } = await supabase.from('ad_accounts').upsert(
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

  if (upsertError) {
    console.error('[google-callback] ad_accounts upsert failed:', upsertError.message);
    return NextResponse.redirect(`${appUrl}/performance?error=connect_store_failed`);
  }

  // Sync inline with the admin client so data lands on the first return and
  // isn't cut off by the serverless runtime freezing after the redirect.
  try {
    await runSyncAdPlatformForTenant(tenantId, 'google', supabase);
  } catch (err) {
    console.error('[google-callback] ads sync error', err);
  }
  try {
    await runSyncSEOForTenant(tenantId, supabase);
  } catch (err) {
    console.error('[google-callback] SEO/GSC sync error', err);
  }

  return oauthSuccessRedirect(appUrl, state.returnTo, 'google');
}
