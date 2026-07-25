import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeCompetitorUrl, deriveCompetitorName } from '@/features/competitors/lib/competitor-url';
import { contentHash, isCompetitorDue, looksLikeSpaShell, COMPETITOR_CHECK_INTERVAL_DAYS } from '@/lib/competitors/track';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('normalizeCompetitorUrl', () => {
  it('adds a scheme when one is missing', () => {
    expect(normalizeCompetitorUrl('rakip.com')?.url).toBe('https://rakip.com/');
    expect(normalizeCompetitorUrl('rakip.com')?.host).toBe('rakip.com');
  });

  it('strips www and lowercases the host', () => {
    expect(normalizeCompetitorUrl('https://WWW.Rakip.COM/urunler')?.host).toBe('rakip.com');
  });

  it('keeps a meaningful path and query but drops the fragment', () => {
    const out = normalizeCompetitorUrl('https://rakip.com/kampanya?ref=x#bolum');
    expect(out?.url).toBe('https://rakip.com/kampanya?ref=x');
  });

  it('rejects empty or malformed input', () => {
    expect(normalizeCompetitorUrl('')).toBeNull();
    expect(normalizeCompetitorUrl('   ')).toBeNull();
    expect(normalizeCompetitorUrl('not a url')).toBeNull();
    expect(normalizeCompetitorUrl('rakip')).toBeNull(); // no dot
  });

  it('rejects non-http schemes', () => {
    expect(normalizeCompetitorUrl('ftp://rakip.com')).toBeNull();
    expect(normalizeCompetitorUrl('javascript:alert(1)')).toBeNull();
  });

  it('refuses to point the crawler at internal hosts', () => {
    expect(normalizeCompetitorUrl('http://localhost:3000')).toBeNull();
    expect(normalizeCompetitorUrl('http://127.0.0.1')).toBeNull();
    expect(normalizeCompetitorUrl('http://192.168.1.5')).toBeNull();
    expect(normalizeCompetitorUrl('http://intranet.local')).toBeNull();
  });
});

describe('deriveCompetitorName', () => {
  it('titdecases the first host label', () => {
    expect(deriveCompetitorName('rakip.com')).toBe('Rakip');
    expect(deriveCompetitorName('luxbrand.co.uk')).toBe('Luxbrand');
  });
});

describe('looksLikeSpaShell', () => {
  it('flags a big HTML payload with almost no readable text', () => {
    const shell = '<html><head><script src="/app.js"></script></head><body><div id="root"></div></body></html>'.repeat(100);
    expect(looksLikeSpaShell(shell, 'Yükleniyor...')).toBe(true);
  });

  it('does not flag a normal server-rendered page', () => {
    const html = '<html><body>' + '<p>Gerçek içerik paragrafı.</p>'.repeat(300) + '</body></html>';
    const text = 'Gerçek içerik paragrafı. '.repeat(300);
    expect(looksLikeSpaShell(html, text)).toBe(false);
  });

  it('does not flag a genuinely tiny page', () => {
    // Small HTML with small text is just a small page, not a JS shell.
    expect(looksLikeSpaShell('<html><body>Merhaba</body></html>', 'Merhaba')).toBe(false);
  });
});

describe('contentHash', () => {
  it('is stable for identical text', () => {
    expect(contentHash('aynı içerik')).toBe(contentHash('aynı içerik'));
  });

  it('differs when the text changes', () => {
    expect(contentHash('v1')).not.toBe(contentHash('v2'));
  });
});

describe('isCompetitorDue', () => {
  const now = new Date('2026-07-21T12:00:00Z');

  it('is due when never checked', () => {
    expect(isCompetitorDue(null, now)).toBe(true);
  });

  it('is not due within the interval', () => {
    const recent = new Date(now.getTime() - 1 * 86_400_000).toISOString();
    expect(isCompetitorDue(recent, now)).toBe(false);
  });

  it('becomes due once the interval has elapsed', () => {
    const old = new Date(now.getTime() - (COMPETITOR_CHECK_INTERVAL_DAYS + 1) * 86_400_000).toISOString();
    expect(isCompetitorDue(old, now)).toBe(true);
  });

  it('treats an unparseable timestamp as due', () => {
    expect(isCompetitorDue('not-a-date', now)).toBe(true);
  });
});

/**
 * Competitor pages get crawled and summarised; a stuck throttle or a missing
 * demo guard would either hammer a site or fabricate rival activity on a
 * showroom tenant. These pin the safety-relevant structure.
 */
describe('change-detection core', () => {
  const track = read('lib/competitors/track.ts');

  it('only writes a snapshot when the hash changes', () => {
    expect(track).toContain('if (prev && prev.content_hash === hash)');
    expect(track).toContain("return { status: 'unchanged' }");
  });

  it('does not summarise the baseline capture', () => {
    expect(track).toContain('const isBaseline = !prev');
    expect(track).toContain('isBaseline\n    ? null');
  });

  it('advances the throttle even on error or no change', () => {
    // stamp() must run on every exit path, or a broken competitor never yields.
    const stampCalls = track.match(/await stamp\(\)/g) ?? [];
    expect(stampCalls.length).toBeGreaterThanOrEqual(4);
  });

  it('degrades to no summary when DeepSeek is unconfigured', () => {
    expect(track).toContain('if (!apiKey) return null');
  });

  it('extracts and stores prices on every snapshot', () => {
    expect(track).toContain('const prices = extractPrices(text)');
    expect(track).toContain('prices,');
  });

  it('leads the summary with a price move so it cannot get buried', () => {
    expect(track).toContain('summarizePriceDiff(prev?.prices ?? [], prices)');
    expect(track).toContain('💰 Fiyat:');
  });

  it('falls back to a rendered fetch for SPA shells', () => {
    expect(track).toContain('if (looksLikeSpaShell(html, text))');
    expect(track).toContain('fetchRenderedText(competitor.url)');
    // Renderer failure must not lose the direct-fetch text.
    expect(track).toContain('rendered && rendered.length > text.length');
  });
});

describe('cron integration', () => {
  const cron = read('app/api/cron/sync-all/route.ts');

  it('respects the throttle and skips demo tenants', () => {
    expect(cron).toContain('isCompetitorDue(comp.last_checked_at)');
    expect(cron).toMatch(/if \(!isDemo\)[\s\S]{0,400}competitors/);
  });

  it('notifies the agency only on an actual change', () => {
    expect(cron).toContain("res.status === 'changed'");
    expect(cron).toContain("from('notifications').insert");
  });

  it('raises a louder alert for a price change', () => {
    expect(cron).toContain('res.priceChange');
    expect(cron).toContain("type: isPrice ? 'alert' : 'info'");
  });
});

describe('MonoAI competitor tool', () => {
  const tool = read('features/ai-chat/tools/get-competitors.ts');

  it('is tenant-scoped and read-only', () => {
    expect(tool).toContain("eq('tenant_id', context.tenantId)");
    expect(tool).not.toContain('.insert(');
    expect(tool).not.toContain('.update(');
  });

  it('reports an honest empty state instead of inventing competitors', () => {
    expect(tool).toContain('henüz takip edilen rakip yok');
  });
});
