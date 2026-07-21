import { describe, it, expect } from 'vitest';
import {
  showroomAggregateMetrics,
  showroomPlatformMetrics,
  showroomPlatformComparison,
  showroomCampaigns,
  showroomGscSeoMatrix,
  showroomGa4Snapshot,
  showroomSpendChart,
} from '@/lib/demo/showroom-data';

/**
 * Demo tenants are the only place fabricated numbers are allowed, and the whole
 * showroom pitch rests on them looking plausible and self-consistent. Real
 * tenants must never reach this module — that boundary is enforced by the
 * `isDemoTenant` guard in every fetcher.
 */
describe('showroom aggregate metrics', () => {
  for (const range of ['daily', 'weekly', 'monthly'] as const) {
    it(`returns a populated, self-consistent set for the ${range} range`, () => {
      const agg = showroomAggregateMetrics(range, 'all');

      expect(agg.hasData).toBe(true);
      expect(agg.spend.current).toBeGreaterThan(0);
      expect(agg.revenue.current).toBeGreaterThan(0);
      expect(agg.impressions.current).toBeGreaterThan(0);

      // ROAS must actually equal revenue / spend, or the demo contradicts itself.
      expect(agg.roas.current).toBeCloseTo(agg.revenue.current / agg.spend.current, 1);

      // CTR is a percentage of impressions, never above 100.
      expect(agg.ctr.current).toBeGreaterThan(0);
      expect(agg.ctr.current).toBeLessThan(100);

      // Clicks cannot exceed impressions.
      expect(agg.clicks.current).toBeLessThanOrEqual(agg.impressions.current);
    });
  }

  it('is deterministic — two calls agree', () => {
    expect(showroomAggregateMetrics('monthly', 'all')).toEqual(
      showroomAggregateMetrics('monthly', 'all'),
    );
  });

  it('scopes to a single platform when the cockpit filters', () => {
    const all = showroomAggregateMetrics('monthly', 'all');
    const meta = showroomAggregateMetrics('monthly', 'meta');
    expect(meta.spend.current).toBeGreaterThan(0);
    expect(meta.spend.current).toBeLessThan(all.spend.current);
  });
});

describe('showroom platform breakdown', () => {
  it('covers the three paid channels', () => {
    const rows = showroomPlatformMetrics('monthly', 'all');
    expect(rows.map((r) => r.platform).sort()).toEqual(['google', 'meta', 'tiktok']);
  });

  it('returns only the requested channel when filtered', () => {
    const rows = showroomPlatformMetrics('monthly', 'google');
    expect(rows).toHaveLength(1);
    expect(rows[0].platform).toBe('google');
  });

  it('produces no paid rows on the SEO surface', () => {
    expect(showroomCampaigns('seo')).toEqual([]);
  });

  it('keeps comparison rows aligned with the platform list', () => {
    const comparison = showroomPlatformComparison('monthly', 'all');
    expect(comparison.length).toBeGreaterThan(0);
    for (const row of comparison) {
      expect(row.spend).toBeGreaterThan(0);
      expect(row.roas).toBeGreaterThan(0);
    }
  });
});

describe('showroom campaigns', () => {
  const rows = showroomCampaigns('all');

  it('gives every campaign a goal to render a progress bar against', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const c of rows) {
      expect(c.goalImpressions).toBeGreaterThan(c.impressions);
      expect(c.goalClicks).toBeGreaterThan(c.clicks);
      expect(c.goalSpend).toBeGreaterThan(c.spend);
    }
  });

  it('never reports more clicks than impressions', () => {
    for (const c of rows) {
      expect(c.clicks).toBeLessThan(c.impressions);
    }
  });

  it('uses stable ids so React keys do not thrash', () => {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('showroom SEO matrix', () => {
  const gsc = showroomGscSeoMatrix();

  it('reports non-brand as a subset of total impressions', () => {
    expect(gsc.nonBrandImpressions).toBeLessThan(gsc.impressions);
  });

  it('derives CTR from its own clicks and impressions', () => {
    expect(gsc.ctrPercent).toBeCloseTo((gsc.clicks / gsc.impressions) * 100, 1);
  });

  it('ships Core Web Vitals in a believable range', () => {
    expect(gsc.cwv.lcp).toBeGreaterThan(0);
    expect(gsc.cwv.lcp).toBeLessThan(10);
    expect(gsc.cwv.cls).toBeLessThan(1);
  });
});

describe('showroom GA4 snapshot', () => {
  const ga4 = showroomGa4Snapshot();

  it('presents as connected so the demo shows the populated state', () => {
    expect(ga4.connected).toBe(true);
    expect(ga4.propertyName).toBeTruthy();
  });

  it('totals match the channel breakdown that renders beneath them', () => {
    const channelSessions = ga4.channels.reduce((n, c) => n + c.sessions, 0);
    expect(ga4.sessions).toBe(channelSessions);

    const channelConversions = ga4.channels.reduce((n, c) => n + c.conversions, 0);
    expect(ga4.conversions).toBe(channelConversions);
  });

  it('keeps users below sessions and engagement a valid percentage', () => {
    expect(ga4.activeUsers).toBeLessThan(ga4.sessions);
    expect(ga4.newUsers).toBeLessThan(ga4.activeUsers);
    expect(ga4.engagementRatePct).toBeGreaterThan(0);
    expect(ga4.engagementRatePct).toBeLessThan(100);
  });

  it('orders channels so the table leads with the biggest', () => {
    const sessions = ga4.channels.map((c) => c.sessions);
    expect([...sessions].sort((a, b) => b - a)).toEqual(sessions);
  });
});

describe('showroom spend chart', () => {
  it('returns a dated series for the paid surface', () => {
    const chart = showroomSpendChart('monthly', 'all');
    expect(chart.length).toBeGreaterThan(0);
    for (const point of chart) {
      expect(point.date).toMatch(/\d/);
    }
  });
});
