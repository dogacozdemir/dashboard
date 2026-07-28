import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The OAuth callbacks run on a fixed host (the registered redirect_uri), where
 * the NextAuth session cookie is not reliably visible. Requiring a session there
 * silently dropped the whole connection — the callback redirected to /login
 * before the token was ever stored, so the tenant looked "never connected".
 *
 * These guards keep the callbacks session-independent: the signed HMAC state is
 * the authorization, the token is written with the admin client, upsert errors
 * are surfaced, and the sync runs inline (not fire-and-forget) so serverless
 * doesn't kill it after the redirect.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const PROVIDERS = ['meta', 'google', 'tiktok'] as const;

describe.each(PROVIDERS)('%s OAuth callback', (provider) => {
  const src = read(`app/api/oauth/${provider}/callback/route.ts`);

  it('never bails to /login when the session cookie is absent', () => {
    expect(src).not.toMatch(/if\s*\(\s*!sessionUser\s*\)/);
    expect(src).not.toContain('/login`');
  });

  it('still rejects a mismatched non-admin tenant when a session is present', () => {
    expect(src).toContain('sessionUser &&');
    expect(src).toContain("!== state.tenantId");
    expect(src).toContain('/unauthorized`');
  });

  it('verifies the signed state before trusting the tenant id', () => {
    expect(src).toContain('verifyOAuthState');
  });

  it('writes the token with the admin client, not the session-scoped one', () => {
    expect(src).toContain('createSupabaseAdminClient()');
    expect(src).not.toContain('createSupabaseServerClient');
  });

  it('surfaces an upsert failure instead of swallowing it', () => {
    expect(src).toContain('upsertError');
    expect(src).toContain('connect_store_failed');
  });

  it('syncs inline with the admin client (no fire-and-forget)', () => {
    expect(src).toContain('runSyncAdPlatformForTenant');
    expect(src).toMatch(/await runSyncAdPlatformForTenant\(/);
    // The session-bound wrapper must not be used here — it needs a request session.
    expect(src).not.toMatch(/\bsyncAdPlatform\(/);
  });
});

// TikTok's token endpoint authenticates with app_id/secret/auth_code and takes
// no redirect_uri; only Meta and Google echo the registered (fixed-host) URI.
describe.each(['meta', 'google'] as const)('%s token exchange', (provider) => {
  it('presents the registered (fixed-host) redirect_uri', () => {
    const src = read(`app/api/oauth/${provider}/callback/route.ts`);
    expect(src).toContain('${oauthBase}/api/oauth/');
  });
});
