import { describe, it, expect, afterEach } from 'vitest';
import {
  parseCockpitPlatform,
  dailyMetricPlatformsFilter,
  isPaidCockpitView,
  cockpitShowsExecutiveTrend,
} from '@/features/performance-hub/lib/cockpit-platform';

describe('parseCockpitPlatform', () => {
  it('accepts every valid platform segment', () => {
    for (const p of ['all', 'meta', 'google', 'tiktok', 'seo'] as const) {
      expect(parseCockpitPlatform(p)).toBe(p);
    }
  });

  it('falls back to "all" for junk or missing input', () => {
    expect(parseCockpitPlatform(undefined)).toBe('all');
    expect(parseCockpitPlatform('')).toBe('all');
    expect(parseCockpitPlatform('facebook')).toBe('all');
    expect(parseCockpitPlatform('__proto__')).toBe('all');
  });
});

describe('dailyMetricPlatformsFilter', () => {
  it('applies no filter for the combined view', () => {
    expect(dailyMetricPlatformsFilter('all')).toBeNull();
  });

  it('maps the SEO view onto organic rows', () => {
    expect(dailyMetricPlatformsFilter('seo')).toEqual(['organic']);
  });

  it('scopes a paid view to its own platform', () => {
    expect(dailyMetricPlatformsFilter('meta')).toEqual(['meta']);
    expect(dailyMetricPlatformsFilter('google')).toEqual(['google']);
    expect(dailyMetricPlatformsFilter('tiktok')).toEqual(['tiktok']);
  });
});

describe('cockpit view predicates', () => {
  it('treats SEO as the only non-paid surface', () => {
    expect(isPaidCockpitView('seo')).toBe(false);
    for (const p of ['all', 'meta', 'google', 'tiktok'] as const) {
      expect(isPaidCockpitView(p)).toBe(true);
    }
  });

  it('shows the executive trend exactly on paid surfaces', () => {
    for (const p of ['all', 'meta', 'google', 'tiktok', 'seo'] as const) {
      expect(cockpitShowsExecutiveTrend(p)).toBe(isPaidCockpitView(p));
    }
  });
});

/**
 * OAuth redirect_uri must match what's registered with the provider. Falling
 * through to localhost in production silently breaks every connect flow, which
 * is exactly the bug these cases pin down.
 */
describe('getAppUrl', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  async function load() {
    // The module reads env at call time, but re-import keeps cases isolated.
    const mod = await import('@/lib/utils/app-url');
    return mod.getAppUrl;
  }

  it('prefers NEXTAUTH_URL when set', async () => {
    process.env.NEXTAUTH_URL = 'https://auth.example.com';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.example.com';
    expect((await load())()).toBe('https://auth.example.com');
  });

  it('falls back to the public site URL instead of localhost', async () => {
    delete process.env.NEXTAUTH_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://madmonos.com';
    expect((await load())()).toBe('https://madmonos.com');
  });

  it('strips trailing slashes so redirect_uri concatenation stays exact', async () => {
    delete process.env.NEXTAUTH_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://madmonos.com///';
    expect((await load())()).toBe('https://madmonos.com');
  });

  it('only uses localhost when nothing is configured', async () => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect((await load())()).toBe('http://localhost:3000');
  });

  it('ignores an empty string rather than producing a bare path', async () => {
    process.env.NEXTAUTH_URL = '';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://madmonos.com';
    expect((await load())()).toBe('https://madmonos.com');
  });
});

/**
 * The apex domain hosts the corporate website (separate deployment), so OAuth
 * callbacks live on a fixed subdomain. These cases pin the env override and the
 * open-redirect guard on the tenant origin carried in signed state.
 */
describe('getOAuthBaseUrl / sanitizeTenantOrigin', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  async function load() {
    return import('@/lib/utils/app-url');
  }

  it('prefers OAUTH_REDIRECT_BASE over the app URL', async () => {
    process.env.OAUTH_REDIRECT_BASE = 'https://app.madmonos.com/';
    process.env.NEXTAUTH_URL = 'https://madmonos.com';
    expect((await load()).getOAuthBaseUrl()).toBe('https://app.madmonos.com');
  });

  it('falls back to getAppUrl when OAUTH_REDIRECT_BASE is unset', async () => {
    delete process.env.OAUTH_REDIRECT_BASE;
    process.env.NEXTAUTH_URL = 'https://madmonos.com';
    expect((await load()).getOAuthBaseUrl()).toBe('https://madmonos.com');
  });

  it('accepts a tenant subdomain of the public root domain', async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'madmonos.com';
    const { sanitizeTenantOrigin } = await load();
    expect(sanitizeTenantOrigin('https://retroline.madmonos.com')).toBe(
      'https://retroline.madmonos.com',
    );
    expect(sanitizeTenantOrigin('https://madmonos.com')).toBe('https://madmonos.com');
  });

  it('rejects foreign hosts and http downgrades (open-redirect guard)', async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'madmonos.com';
    const { sanitizeTenantOrigin } = await load();
    expect(sanitizeTenantOrigin('https://evil.com')).toBeNull();
    expect(sanitizeTenantOrigin('https://madmonos.com.evil.com')).toBeNull();
    expect(sanitizeTenantOrigin('http://retroline.madmonos.com')).toBeNull();
    expect(sanitizeTenantOrigin('not a url')).toBeNull();
    expect(sanitizeTenantOrigin(null)).toBeNull();
  });

  it('allows local dev origins', async () => {
    const { sanitizeTenantOrigin } = await load();
    expect(sanitizeTenantOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(sanitizeTenantOrigin('http://retroline.lvh.me:3000')).toBe(
      'http://retroline.lvh.me:3000',
    );
  });
});

describe('OAuth routes use the fixed redirect base', () => {
  const read = (p: string) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('node:fs').readFileSync(`${process.cwd()}/${p}`, 'utf8') as string;

  it.each(['meta', 'google', 'tiktok'])('%s start route', (prov) => {
    const src = read(`app/api/oauth/${prov}/route.ts`);
    expect(src).toContain('getOAuthBaseUrl');
    expect(src).toContain('getRequestOrigin(req)');
  });

  it.each(['meta', 'google', 'tiktok'])('%s callback returns to the tenant origin', (prov) => {
    const src = read(`app/api/oauth/${prov}/callback/route.ts`);
    expect(src).toContain('sanitizeTenantOrigin(state?.origin)');
  });

  it('token exchanges present the registered redirect_uri', () => {
    for (const prov of ['meta', 'google']) {
      const src = read(`app/api/oauth/${prov}/callback/route.ts`);
      expect(src, prov).toContain('${oauthBase}/api/oauth/');
    }
  });

  it('app/api are reserved — never treated as tenant slugs', async () => {
    const { isScopedTenantHostSlug } = await import('@/lib/utils/parse-tenant-host');
    expect(isScopedTenantHostSlug('app')).toBe(false);
    expect(isScopedTenantHostSlug('api')).toBe(false);
    expect(isScopedTenantHostSlug('retroline')).toBe(true);
    const { RESERVED_TENANT_SLUGS } = await import('@/features/admin/lib/tenant-slug');
    expect(RESERVED_TENANT_SLUGS.has('app')).toBe(true);
  });
});
