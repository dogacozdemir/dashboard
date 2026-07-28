import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * The session cookie must span every tenant subdomain (`.madmonos.com`),
 * otherwise the login is lost the moment the OAuth round-trip passes through the
 * fixed callback host. `NEXT_PUBLIC_ROOT_DOMAIN` is the intended source, but when
 * it's missing it defaults to `lvh.me` and the cookie silently becomes host-only.
 * These cases pin the production fallback that derives the domain from
 * `NEXTAUTH_URL` so a forgotten env var can't quietly break cross-subdomain auth.
 */
describe('getSharedCookieDomain', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllEnvs();
  });

  async function load() {
    vi.resetModules();
    return (await import('@/lib/auth/cookie-domain')).getSharedCookieDomain;
  }

  it('uses NEXT_PUBLIC_ROOT_DOMAIN when set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'madmonos.com');
    expect((await load())()).toBe('.madmonos.com');
  });

  it('derives the domain from NEXTAUTH_URL when the root env is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', '');
    vi.stubEnv('NEXTAUTH_URL', 'https://app.madmonos.com');
    expect((await load())()).toBe('.madmonos.com');
  });

  it('derives from a tenant-subdomain NEXTAUTH_URL too', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', '');
    vi.stubEnv('NEXTAUTH_URL', 'https://retroline.madmonos.com');
    expect((await load())()).toBe('.madmonos.com');
  });

  it('falls back to OAUTH_REDIRECT_BASE when that is the only real URL', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', '');
    vi.stubEnv('NEXTAUTH_URL', '');
    vi.stubEnv('OAUTH_REDIRECT_BASE', 'https://api.madmonos.com');
    expect((await load())()).toBe('.madmonos.com');
  });

  it('returns undefined in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'madmonos.com');
    expect((await load())()).toBeUndefined();
  });

  it('returns undefined when only local hosts resolve', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', '');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('OAUTH_REDIRECT_BASE', '');
    expect((await load())()).toBeUndefined();
  });
});
