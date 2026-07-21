/**
 * Pure anomaly-threshold logic, split out of `anomaly.ts` so the rules can be
 * exercised without a database, an inbox, or a push endpoint. `anomaly.ts` keeps
 * the I/O: reading the windows, writing the notification, sending the mail.
 */

export interface MetricWindow {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface AnomalyCandidate {
  key: 'roas-down' | 'spend-up' | 'ctr-down' | 'conv-down';
  /** Percentage magnitude of the swing — also the ranking score. */
  severity: number;
  title: string;
  body: string;
}

export type AnomalyVerdict =
  | { fired: false; reason: 'low-volume' | 'no-anomaly' }
  | { fired: true; top: AnomalyCandidate; candidates: AnomalyCandidate[] };

/** Days covered by each comparison window. */
export const RECENT_DAYS = 3;
export const BASELINE_DAYS = 14;

/** A baseline this thin can't support a conclusion — staying quiet beats crying wolf. */
export const MIN_BASELINE_IMPRESSIONS = 1000;

export const THRESHOLDS = {
  roasDropPct: 30,
  spendRisePct: 60,
  ctrDropPct: 35,
  convDropPct: 50,
  /** CTR needs some recent reach before its ratio means anything. */
  minRecentImpressionsForCtr: 300,
  /** Conversions are lumpy at low volume; require a real daily baseline. */
  minBaselineConversionsPerDay: 3,
} as const;

const dropPct = (rec: number, base: number) => (base > 0 ? Math.round(((base - rec) / base) * 100) : 0);
const risePct = (rec: number, base: number) => (base > 0 ? Math.round(((rec - base) / base) * 100) : 0);

export function evaluateAnomalies(recent: MetricWindow, baseline: MetricWindow): AnomalyVerdict {
  if (baseline.impressions < MIN_BASELINE_IMPRESSIONS || baseline.spend <= 0) {
    return { fired: false, reason: 'low-volume' };
  }

  const recRoas = recent.spend > 0 ? recent.revenue / recent.spend : 0;
  const baseRoas = baseline.spend > 0 ? baseline.revenue / baseline.spend : 0;
  const recCtr = recent.impressions > 0 ? recent.clicks / recent.impressions : 0;
  const baseCtr = baseline.impressions > 0 ? baseline.clicks / baseline.impressions : 0;
  const recSpendPerDay = recent.spend / RECENT_DAYS;
  const baseSpendPerDay = baseline.spend / BASELINE_DAYS;
  const recConvPerDay = recent.conversions / RECENT_DAYS;
  const baseConvPerDay = baseline.conversions / BASELINE_DAYS;

  const candidates: AnomalyCandidate[] = [];

  if (baseRoas > 0 && recent.spend > 0) {
    const d = dropPct(recRoas, baseRoas);
    if (d >= THRESHOLDS.roasDropPct) {
      candidates.push({
        key: 'roas-down',
        severity: d,
        title: 'ROAS düşüşü',
        body: `Son 3 günde ROAS ~%${d} düştü (${recRoas.toFixed(2)} vs ${baseRoas.toFixed(2)}). En verimli kampanyalara bütçe kaydırmayı değerlendir.`,
      });
    }
  }

  if (baseSpendPerDay > 0) {
    const r = risePct(recSpendPerDay, baseSpendPerDay);
    if (r >= THRESHOLDS.spendRisePct) {
      candidates.push({
        key: 'spend-up',
        severity: r,
        title: 'Harcama sıçraması',
        body: `Günlük harcama ~%${r} arttı. Kampanya bütçelerini ve teklif stratejisini kontrol et.`,
      });
    }
  }

  if (baseCtr > 0 && recent.impressions >= THRESHOLDS.minRecentImpressionsForCtr) {
    const d = dropPct(recCtr, baseCtr);
    if (d >= THRESHOLDS.ctrDropPct) {
      candidates.push({
        key: 'ctr-down',
        severity: d,
        title: 'CTR düşüşü',
        body: `CTR ~%${d} düştü. Kreatif yorgunluğu olabilir — görselleri/başlıkları yenilemeyi düşün.`,
      });
    }
  }

  if (baseConvPerDay >= THRESHOLDS.minBaselineConversionsPerDay) {
    const d = dropPct(recConvPerDay, baseConvPerDay);
    if (d >= THRESHOLDS.convDropPct) {
      candidates.push({
        key: 'conv-down',
        severity: d,
        title: 'Dönüşüm düşüşü',
        body: `Günlük dönüşümler ~%${d} düştü. Dönüşüm hunisini ve açılış sayfalarını gözden geçir.`,
      });
    }
  }

  if (candidates.length === 0) return { fired: false, reason: 'no-anomaly' };

  const sorted = [...candidates].sort((a, b) => b.severity - a.severity);
  return { fired: true, top: sorted[0], candidates: sorted };
}
