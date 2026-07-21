import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

/**
 * Product rule: a demo tenant may show fabricated showroom numbers; a real
 * tenant must never see anything it didn't actually earn. Both halves of that
 * boundary are structural, so they're checked structurally.
 */
describe('every showroom fetcher is gated behind isDemoTenant', () => {
  const source = read('features/performance-hub/actions/fetchMetrics.ts');
  const lines = source.split('\n');

  const callSites = lines
    .map((line, i) => ({ line, n: i }))
    .filter(({ line }) => /\breturn\s+showroom[A-Za-z]*\(/.test(line) || /=\s*showroom[A-Za-z]*\(/.test(line));

  it('finds the showroom call sites at all (guards the test itself)', () => {
    expect(callSites.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps an isDemoTenant check within a few lines above each one', () => {
    for (const { line, n } of callSites) {
      // The guard is either on the same line or opens the block just above it.
      const window = lines.slice(Math.max(0, n - 4), n + 1).join('\n');
      expect(window, `unguarded showroom call at line ${n + 1}: ${line.trim()}`).toContain(
        'isDemoTenant',
      );
    }
  });
});

describe('sync jobs never write fabricated data to a demo tenant', () => {
  const sync = read('features/oauth/actions/syncPlatformData.ts');

  for (const fn of ['runSyncSEOForTenant', 'runSyncAdPlatformForTenant']) {
    it(`${fn} bails out on is_demo before touching any API`, () => {
      const start = sync.indexOf(`export async function ${fn}`);
      expect(start, `${fn} not found`).toBeGreaterThan(-1);

      // Look at the opening of the function only — the guard must come first.
      const head = sync.slice(start, start + 500);
      expect(head).toContain("select('is_demo')");
      expect(head).toMatch(/is_demo[\s\S]{0,120}return/);
    });
  }

  it('skips anomaly alerts and site crawls for demo tenants in the cron job', () => {
    const cron = read('app/api/cron/sync-all/route.ts');
    expect(cron).toContain('const isDemo =');
    expect(cron).toContain('if (!isDemo && platforms.length > 0)');
    expect(cron).toContain('if (!isDemo) {');
  });

  it('skips the weekly digest for demo tenants', () => {
    const digest = read('app/api/cron/weekly-digest/route.ts');
    expect(digest).toMatch(/is_demo[\s\S]{0,80}continue/);
  });
});
