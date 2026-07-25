import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural guards for the "real data only" pass:
 *  G1 — Instagram feed carries real like/comment counts.
 *  G2 — SEO/GEO narratives are grounded in measured data and follow the
 *       viewer's language; no fabricated insight on real tenants.
 *  G3 — Competitor detail exposes product→price mapping and change history.
 *  G4 — Disconnected channels are hidden instead of shown with empty/fake data.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('G1: Instagram real engagement counts', () => {
  const src = read('features/oauth/actions/fetchInstagramHybridFeed.ts');

  it('requests like_count and comments_count from the Graph API', () => {
    expect(src).toContain('like_count');
    expect(src).toContain('comments_count');
  });

  it('maps counts onto the hybrid feed post', () => {
    expect(src).toContain('likeCount');
    expect(src).toContain('commentsCount');
  });

  it('type carries optional counts', () => {
    const types = read('features/creative-studio/types.ts');
    expect(types).toMatch(/likeCount\?:\s*number\s*\|\s*null/);
    expect(types).toMatch(/commentsCount\?:\s*number\s*\|\s*null/);
  });
});

describe('G2: grounded, locale-aware SEO/GEO narratives', () => {
  const strategy = read('features/strategy-technical/actions/fetchStrategy.ts');
  const geoReport = read('features/strategy/actions/generateGeoReport.ts');

  it('market insight refuses to run without measured signal on real tenants', () => {
    expect(strategy).toContain('hasSignal');
    expect(strategy).toContain('isDemoTenant');
  });

  it('market insight cache is per-locale', () => {
    expect(strategy).toContain('market_insight_${locale}');
  });

  it('reads follow the viewer locale', () => {
    expect(strategy).toContain('viewerLocale');
  });

  it('insight prompt forbids inventing metrics', () => {
    expect(strategy).toMatch(/Never invent metrics/i);
  });

  it('GEO report generates both Turkish and English content', () => {
    expect(geoReport).toContain('actionableStepsEn');
    expect(geoReport).toMatch(/TURKISH/);
    expect(geoReport).toMatch(/ENGLISH/);
  });

  it('GEO strategy content type has the optional en block', () => {
    const types = read('features/strategy/types.ts');
    expect(types).toMatch(/en\?:\s*\{/);
  });

  it('GEO keyword table is fully i18n (no hardcoded English headers)', () => {
    const table = read('features/strategy-technical/components/GeoKeywordLiquidTable.tsx');
    expect(table).toContain("useTranslations('Features.StrategyTechnical.geoTable')");
    expect(table).not.toMatch(/>Impressions</);
  });
});

describe('G3: competitor product-price detail', () => {
  it('Competitor type carries prices with labels and a change history', () => {
    const types = read('features/competitors/types.ts');
    expect(types).toContain('label?: string');
    expect(types).toMatch(/history:\s*Array<\{ fetchedAt: string; changeSummary: string \| null \}>/);
  });

  it('fetchCompetitors builds the history from changed snapshots', () => {
    const actions = read('features/competitors/actions/competitorActions.ts');
    expect(actions).toContain('history:');
    expect(actions).toMatch(/filter\(\(snap\) => snap\.changed\)/);
  });

  it('panel renders a product→price table and history timeline', () => {
    const panel = read('features/competitors/components/CompetitorPanel.tsx');
    expect(panel).toContain('CompetitorDetail');
    expect(panel).toContain("t('colProduct')");
    expect(panel).toContain("t('colPrice')");
    expect(panel).toContain("t('historyTitle')");
  });

  it('i18n keys exist in both locales', () => {
    for (const file of ['messages/tr.json', 'messages/en.json']) {
      const msgs = JSON.parse(read(file)) as {
        Features: { Competitors: Record<string, string> };
      };
      for (const key of ['colProduct', 'colPrice', 'historyTitle', 'noHistory', 'priceSummary', 'showDetail']) {
        expect(msgs.Features.Competitors[key], `${file} → ${key}`).toBeTruthy();
      }
    }
  });
});

describe('G4: disconnected channels stay hidden', () => {
  it('PlatformSwitcher filters pills by connected platforms (seo needs google)', () => {
    const src = read('features/performance-hub/components/PlatformSwitcher.tsx');
    expect(src).toContain('connected');
    expect(src).toMatch(/connected\.includes\('google'\)/);
    expect(src).toMatch(/options\.length <= 1/);
  });

  it('performance and dashboard pages thread connectedPlatforms into the toolbar', () => {
    for (const page of ['app/(tenant)/performance/page.tsx', 'app/(tenant)/dashboard/page.tsx']) {
      const src = read(page);
      expect(src, page).toContain('fetchConnectedAdAccounts');
      expect(src, page).toContain('connectedPlatforms={connectedPlatforms}');
    }
  });

  it('PDF spend trend only prints platforms that actually have spend', () => {
    const src = read('features/mono-report/renderMonoReportPdf.ts');
    expect(src).toContain('activePlatforms');
  });

  it('spend chart Y-axis uses the tenant currency symbol, not a hardcoded one', () => {
    const src = read('features/performance-hub/components/SpendChart.tsx');
    expect(src).toContain('currencySymbol');
  });
});
