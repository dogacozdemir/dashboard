import { describe, it, expect } from 'vitest';
import {
  evaluateAnomalies,
  MIN_BASELINE_IMPRESSIONS,
  THRESHOLDS,
  type MetricWindow,
} from '@/lib/alerts/anomaly-rules';

/** Healthy 14-day baseline: 2.0x ROAS, 2% CTR, 42 conversions (3/day). */
const baseline: MetricWindow = {
  spend: 14_000,
  revenue: 28_000,
  impressions: 500_000,
  clicks: 10_000,
  conversions: 42,
};

/** Recent 3-day window that mirrors the baseline exactly, pro-rated. */
const steady: MetricWindow = {
  spend: 3_000,
  revenue: 6_000,
  impressions: 107_142,
  clicks: 2_142,
  conversions: 9,
};

describe('noise floor', () => {
  it('stays silent when the baseline has too few impressions', () => {
    const thin = { ...baseline, impressions: MIN_BASELINE_IMPRESSIONS - 1 };
    const v = evaluateAnomalies(steady, thin);
    expect(v.fired).toBe(false);
    expect(v).toMatchObject({ reason: 'low-volume' });
  });

  it('stays silent when the baseline had no spend', () => {
    const v = evaluateAnomalies(steady, { ...baseline, spend: 0 });
    expect(v).toMatchObject({ fired: false, reason: 'low-volume' });
  });

  it('does not fire on a steady account', () => {
    expect(evaluateAnomalies(steady, baseline)).toMatchObject({
      fired: false,
      reason: 'no-anomaly',
    });
  });
});

describe('ROAS drop', () => {
  it('ignores a dip shallower than the threshold', () => {
    // 2.0x → 1.6x is a 20% drop, under the 30% bar.
    const v = evaluateAnomalies({ ...steady, revenue: 4_800 }, baseline);
    expect(v.fired).toBe(false);
  });

  it('fires once the drop reaches the threshold', () => {
    // 2.0x → 1.4x is exactly 30%.
    const v = evaluateAnomalies({ ...steady, revenue: 4_200 }, baseline);
    expect(v.fired).toBe(true);
    if (v.fired) {
      expect(v.top.key).toBe('roas-down');
      expect(v.top.severity).toBe(THRESHOLDS.roasDropPct);
    }
  });

  it('does not divide by zero when recent spend is zero', () => {
    const v = evaluateAnomalies({ ...steady, spend: 0, revenue: 0 }, baseline);
    // Zero spend means no ROAS signal — spend-up must not fire either.
    if (v.fired) expect(v.candidates.map((c) => c.key)).not.toContain('roas-down');
  });
});

describe('spend spike', () => {
  it('fires when daily spend rises past the threshold', () => {
    // Baseline is 1000/day; 1600/day is a 60% rise.
    const v = evaluateAnomalies({ ...steady, spend: 4_800, revenue: 9_600 }, baseline);
    expect(v.fired).toBe(true);
    if (v.fired) expect(v.candidates.some((c) => c.key === 'spend-up')).toBe(true);
  });

  it('ignores a rise below the threshold', () => {
    // 1400/day is a 40% rise.
    const v = evaluateAnomalies({ ...steady, spend: 4_200, revenue: 8_400 }, baseline);
    expect(v.fired).toBe(false);
  });
});

describe('CTR drop', () => {
  it('fires when CTR collapses with enough reach', () => {
    // 2% → 1.2% is a 40% drop, over the 35% bar.
    const v = evaluateAnomalies({ ...steady, clicks: 1_285 }, baseline);
    expect(v.fired).toBe(true);
    if (v.fired) expect(v.candidates.some((c) => c.key === 'ctr-down')).toBe(true);
  });

  it('suppresses the CTR rule below the minimum recent reach', () => {
    const tinyReach: MetricWindow = {
      ...steady,
      impressions: THRESHOLDS.minRecentImpressionsForCtr - 1,
      clicks: 0,
    };
    const v = evaluateAnomalies(tinyReach, baseline);
    if (v.fired) expect(v.candidates.map((c) => c.key)).not.toContain('ctr-down');
  });
});

describe('conversion drop', () => {
  it('fires when daily conversions halve', () => {
    // Baseline 3/day; 1.33/day is a 56% drop.
    const v = evaluateAnomalies({ ...steady, conversions: 4 }, baseline);
    expect(v.fired).toBe(true);
    if (v.fired) expect(v.candidates.some((c) => c.key === 'conv-down')).toBe(true);
  });

  it('suppresses the rule when the baseline is too lumpy', () => {
    // 14 conversions over 14 days = 1/day, under the 3/day minimum.
    const lumpy = { ...baseline, conversions: 14 };
    const v = evaluateAnomalies({ ...steady, conversions: 0 }, lumpy);
    if (v.fired) expect(v.candidates.map((c) => c.key)).not.toContain('conv-down');
  });
});

describe('ranking', () => {
  it('surfaces the most severe candidate first', () => {
    // ROAS collapses ~70% while spend rises ~60% — ROAS should win on severity.
    const crash: MetricWindow = { ...steady, spend: 4_800, revenue: 2_880, clicks: 2_142 };
    const v = evaluateAnomalies(crash, baseline);
    expect(v.fired).toBe(true);
    if (v.fired) {
      expect(v.candidates.length).toBeGreaterThan(1);
      expect(v.top.severity).toBe(Math.max(...v.candidates.map((c) => c.severity)));
    }
  });
});
