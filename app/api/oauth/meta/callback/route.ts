import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken, packToken } from '@/lib/utils/crypto';
import { syncAdPlatform } from '@/features/oauth/actions/syncPlatformData';
import type { OAuthState } from '@/features/oauth/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code      = searchParams.get('code');
  const stateB64  = searchParams.get('state');
  const appUrl    = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  if (!code || !stateB64) {
    return NextResponse.redirect(`${appUrl}/performance?error=oauth_failed`);
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(stateB64, 'base64url').toString()) as OAuthState;
  } catch {
    return NextResponse.redirect(`${appUrl}/performance?error=invalid_state`);
  }

  const appId     = process.env.META_APP_ID ?? '';
  const appSecret = process.env.META_APP_SECRET ?? '';

  // Exchange code for token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&redirect_uri=${appUrl}/api/oauth/meta/callback` +
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

  return NextResponse.redirect(`${appUrl}${state.returnTo}?connected=meta`);
}
