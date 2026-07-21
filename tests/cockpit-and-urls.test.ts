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
