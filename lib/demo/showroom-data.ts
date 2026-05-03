/**
 * Central mock engine for `is_demo` tenants — deterministic, range-aware, no DB.
 */

import type { LeaderboardEntry, WeeklyDigestData } from '@/features/gamification/types';
import { getLevel } from '@/features/gamification/lib/definitions';
import type { CockpitPlatform } from '@/features/performance-hub/lib/cockpit-platform';
import type {
  AggregateMetrics,
  CampaignRow,
  ChartDataPoint,
  ConnectedAdAccount,
  Platform,
  PlatformMetrics,
  ActivityItem,
} from '@/features/performance-hub/types';

/** Mirrors `fetchMetrics` — avoid importing that module here (circular). */
export type ShowroomTimeRange = 'daily' | 'weekly' | 'monthly';

export interface ShowroomExecutivePoint {
  date: string;
  spend: number;
  revenue: number;
}

export interface ShowroomGscMatrix {
  impressions: number;
  nonBrandImpressions: number;
  avgPosition: number;
  clicks: number;
  ctrPercent: number;
  indexingIssues: number | null;
  gscQueryRowCount: number;
  hasGoogleConnection: boolean;
  cwv: {
    lcp: number | null;
    cls: number | null;
    fidMs: number | null;
    label: string | null;
  };
}

export interface ShowroomPlatformComparisonRow {
  platform: Platform;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  conversions: number;
}

type PlatKey = 'meta' | 'google' | 'tiktok';

function dateRangeFor(range: ShowroomTimeRange): { current: { from: string; to: string }; previous: { from: string; to: string } } {
  const now  = new Date();
  const pad  = (n: number) => String(n).padStart(2, '0');
  const fmt  = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let curFrom: Date, curTo: Date, prevFrom: Date, prevTo: Date;

  if (range === 'daily') {
    curTo   = new Date(now); curFrom = new Date(now);
    prevTo  = new Date(now); prevTo.setDate(prevTo.getDate() - 1);
    prevFrom = new Date(prevTo);
  } else if (range === 'weekly') {
    curTo   = new Date(now);
    curFrom = new Date(now); curFrom.setDate(curFrom.getDate() - 6);
    prevTo  = new Date(curFrom); prevTo.setDate(prevTo.getDate() - 1);
    prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - 6);
  } else {
    curTo    = new Date(now);
    curFrom  = new Date(now); curFrom.setDate(1);
    prevTo   = new Date(curFrom); prevTo.setDate(0);
    prevFrom = new Date(prevTo); prevFrom.setDate(1);
  }

  return {
    current:  { from: fmt(curFrom),  to: fmt(curTo) },
    previous: { from: fmt(prevFrom), to: fmt(prevTo) },
  };
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayIndex(d: Date): number {
  return Math.floor(d.getTime() / 86400000);
}

/** ROAS oscillates in [2.8, 4.5] by day (successful band). */
export function showroomRoasForDate(d: Date): number {
  const idx = dayIndex(d);
  const t     = (Math.sin(idx * 0.31) + 1) / 2;
  return Math.round((2.8 + t * 1.7) * 100) / 100;
}

function weekendFactor(d: Date): number {
  const w = d.getDay();
  return w === 0 || w === 6 ? 0.72 : 1;
}

/** Mid-week lift (Wed/Thu) — “evening / peak” feel on daily aggregates. */
function midweekLift(d: Date): number {
  const w = d.getDay();
  return w === 3 || w === 4 ? 1.12 : 1;
}

function baseSpendForPlatform(p: PlatKey): number {
  if (p === 'meta') return 418;
  if (p === 'google') return 502;
  return 366;
}

function spendForDay(d: Date, p: PlatKey): number {
  const phase = Math.sin(dayIndex(d) * 0.22) * 0.11 + 1;
  return (
    Math.round(baseSpendForPlatform(p) * weekendFactor(d) * midweekLift(d) * phase * 100) / 100
  );
}

type Agg = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roasSum: number;
  days: number;
  revenue: number;
};

function emptyAgg(): Agg {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0, roasSum: 0, days: 0, revenue: 0 };
}

function accumulateRange(
  fromStr: string,
  toStr: string,
  cockpit: CockpitPlatform,
): Record<PlatKey, Agg> {
  const plats: PlatKey[] =
    cockpit === 'all'
      ? ['meta', 'google', 'tiktok']
      : cockpit === 'meta' || cockpit === 'google' || cockpit === 'tiktok'
        ? [cockpit]
        : [];
  const out: Record<PlatKey, Agg> = {
    meta:   emptyAgg(),
    google: emptyAgg(),
    tiktok: emptyAgg(),
  };

  const from = parseISODate(fromStr);
  const to   = parseISODate(toStr);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const roas = showroomRoasForDate(d);
    for (const p of plats) {
      const spend = spendForDay(new Date(d), p);
      const imps  = Math.round(spend * 118 + roas * 4200);
      const clk   = Math.round(imps * 0.028 + spend * 0.35);
      const conv  = Math.max(1, Math.round(clk * 0.045 + spend * 0.002));
      const rev   = spend * roas;
      const a     = out[p];
      a.spend += spend;
      a.impressions += imps;
      a.clicks += clk;
      a.conversions += conv;
      a.roasSum += roas;
      a.days += 1;
      a.revenue += rev;
    }
  }
  return out;
}

const mkDelta = (c: number, p: number) => ({
  current:  c,
  previous: p,
  change:   p > 0 ? ((c - p) / p) * 100 : c > 0 && p === 0 ? 100 : 0,
});

function sumAgg(a: Record<PlatKey, Agg>, field: keyof Agg): number {
  return (['meta', 'google', 'tiktok'] as const).reduce((s, k) => s + (a[k]?.[field] as number), 0);
}

function avgRoasAgg(a: Record<PlatKey, Agg>): number {
  let num = 0;
  let den = 0;
  for (const k of ['meta', 'google', 'tiktok'] as const) {
    if (a[k].days > 0) {
      num += a[k].roasSum / a[k].days;
      den += 1;
    }
  }
  return den > 0 ? num / den : 3.4;
}

function blendedCtr(a: Record<PlatKey, Agg>): number {
  const im = sumAgg(a, 'impressions');
  const cl = sumAgg(a, 'clicks');
  return im > 0 ? (cl / im) * 100 : 2.85;
}

export function showroomAggregateMetrics(
  range: ShowroomTimeRange,
  cockpit: CockpitPlatform,
): AggregateMetrics {
  const { current, previous } = dateRangeFor(range);
  const cur  = accumulateRange(current.from, current.to, cockpit === 'seo' ? 'all' : cockpit);
  const prev = accumulateRange(previous.from, previous.to, cockpit === 'seo' ? 'all' : cockpit);

  const curSpend       = sumAgg(cur, 'spend');
  const prevSpend      = sumAgg(prev, 'spend');
  const curRev         = sumAgg(cur, 'revenue');
  const prevRev        = sumAgg(prev, 'revenue');
  const curImp         = sumAgg(cur, 'impressions');
  const prevImp        = sumAgg(prev, 'impressions');
  const curClk         = sumAgg(cur, 'clicks');
  const prevClk        = sumAgg(prev, 'clicks');
  const curConv        = sumAgg(cur, 'conversions');
  const prevConv       = sumAgg(prev, 'conversions');

  return {
    spend:          mkDelta(curSpend, prevSpend),
    revenue:        mkDelta(curRev, prevRev),
    impressions:    mkDelta(curImp, prevImp * 1.2),
    clicks:         mkDelta(curClk, prevClk * 1.15),
    conversions:    mkDelta(curConv, prevConv * 1.08),
    roas:           mkDelta(avgRoasAgg(cur), avgRoasAgg(prev)),
    cpa:            mkDelta(curConv > 0 ? curSpend / curConv : 0, prevConv > 0 ? prevSpend / prevConv : 0),
    ctr:            mkDelta(blendedCtr(cur), blendedCtr(prev)),
    conversionRate: mkDelta(
      curClk > 0 ? (curConv / curClk) * 100 : 0,
      prevClk > 0 ? (prevConv / prevClk) * 100 : 0,
    ),
    hasData:   cockpit !== 'seo',
    dateRange: current,
  };
}

export function showroomPlatformMetrics(range: ShowroomTimeRange, cockpit: CockpitPlatform): PlatformMetrics[] {
  if (cockpit === 'seo') return [];
  const { current, previous } = dateRangeFor(range);
  const cur  = accumulateRange(current.from, current.to, cockpit);
  const prev = accumulateRange(previous.from, previous.to, cockpit);
  const platforms: PlatKey[] =
    cockpit === 'all' ? ['meta', 'google', 'tiktok'] : [cockpit as PlatKey];

  const empty = emptyAgg();

  return platforms.map((platform) => {
    const c = cur[platform]  ?? { ...empty };
    const p = prev[platform] ?? { ...empty };
    const mk = (cv: number, pv: number) => ({
      current: cv,
      previous: pv,
      change: pv > 0 ? ((cv - pv) / pv) * 100 : cv > 0 && pv === 0 ? 100 : 0,
    });
    const roasC = c.days > 0 ? c.roasSum / c.days : 3.5;
    const roasP = p.days > 0 ? p.roasSum / p.days : 3.2;
    const ctrC  = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 2.9;
    const ctrP  = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 2.7;
    return {
      platform,
      spend:         mk(c.spend, p.spend),
      impressions:   mk(c.impressions, p.impressions),
      clicks:        mk(c.clicks, p.clicks),
      conversions:   mk(c.conversions, p.conversions),
      roas:          mk(roasC, roasP),
      ctr:           mk(ctrC, ctrP),
    };
  });
}

export function showroomPlatformComparison(
  range: ShowroomTimeRange,
  cockpit: CockpitPlatform,
): ShowroomPlatformComparisonRow[] {
  if (cockpit === 'seo') return [];
  const { current } = dateRangeFor(range);
  const cur = accumulateRange(current.from, current.to, cockpit === 'all' ? 'all' : cockpit);
  const platforms: PlatKey[] =
    cockpit === 'all' ? ['meta', 'google', 'tiktok'] : [cockpit as PlatKey];
  return platforms.map((platform) => {
    const v = cur[platform];
    const roas = v.days > 0 ? v.roasSum / v.days : 3.6;
    const cpa  = v.conversions > 0 ? v.spend / v.conversions : 0;
    return {
      platform,
      spend:       v.spend,
      revenue:     v.revenue,
      roas,
      cpa,
      conversions: v.conversions,
    };
  });
}

export function showroomExecutiveTrend(
  range: ShowroomTimeRange,
  cockpit: CockpitPlatform,
): ShowroomExecutivePoint[] {
  if (cockpit === 'seo') return [];
  let days = 14;
  if (range === 'weekly') days = 84;
  if (range === 'monthly') days = 30;

  const to   = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));

  const plats: PlatKey[] =
    cockpit === 'all'
      ? ['meta', 'google', 'tiktok']
      : cockpit === 'meta' || cockpit === 'google' || cockpit === 'tiktok'
        ? [cockpit]
        : [];

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const points: ShowroomExecutivePoint[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    let spend = 0;
    let revenue = 0;
    for (const p of plats) {
      const s = spendForDay(new Date(d), p);
      const r = s * showroomRoasForDate(new Date(d));
      spend += s;
      revenue += r;
    }
    points.push({ date: fmt(new Date(d)), spend, revenue });
  }
  return points;
}

export function showroomSpendChart(range: ShowroomTimeRange, cockpit: CockpitPlatform): ChartDataPoint[] {
  if (cockpit === 'seo') return [];
  let days = 14;
  if (range === 'weekly') days = 28;
  if (range === 'monthly') days = 30;

  const to   = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));

  const plats: PlatKey[] =
    cockpit === 'all'
      ? ['meta', 'google', 'tiktok']
      : cockpit === 'meta' || cockpit === 'google' || cockpit === 'tiktok'
        ? [cockpit]
        : [];

  const out: ChartDataPoint[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const label = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const row: ChartDataPoint = { date: label, meta: 0, google: 0, tiktok: 0 };
    for (const p of plats) {
      row[p] = spendForDay(new Date(d), p);
    }
    out.push(row);
  }
  return out;
}

const SHOWROOM_CAMPAIGNS: Array<{
  platform: PlatKey;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
}> = [
  { platform: 'meta', name: 'Gold Cream Launch', spend: 8420, impressions: 920_000, clicks: 26_400, conversions: 980, roas: 3.95 },
  { platform: 'meta', name: 'Black Friday Meta Engine', spend: 12100, impressions: 1_100_000, clicks: 31_200, conversions: 1420, roas: 4.12 },
  { platform: 'meta', name: 'Aura Video Story', spend: 5340, impressions: 610_000, clicks: 18_900, conversions: 620, roas: 3.22 },
  { platform: 'google', name: 'Night Serum SEO Push', spend: 9840, impressions: 540_000, clicks: 22_100, conversions: 890, roas: 4.35 },
  { platform: 'google', name: 'Performance Max Lux', spend: 15320, impressions: 780_000, clicks: 28_400, conversions: 1680, roas: 3.88 },
  { platform: 'google', name: 'Search Excellence Hub', spend: 7120, impressions: 410_000, clicks: 14_200, conversions: 510, roas: 3.05 },
  { platform: 'tiktok', name: 'TikTok Spark Luxe', spend: 6780, impressions: 890_000, clicks: 24_800, conversions: 720, roas: 3.72 },
  { platform: 'tiktok', name: 'In-Feed Serum Blitz', spend: 9100, impressions: 1_020_000, clicks: 29_100, conversions: 1010, roas: 4.08 },
  { platform: 'tiktok', name: 'Shop Ads Velocity', spend: 5890, impressions: 720_000, clicks: 21_300, conversions: 540, roas: 2.94 },
];

export function showroomCampaigns(cockpit: CockpitPlatform): CampaignRow[] {
  if (cockpit === 'seo') return [];
  const rows = SHOWROOM_CAMPAIGNS.filter((c) => cockpit === 'all' || c.platform === cockpit);
  return rows.map((c, i) => ({
    id:              `showroom-${c.platform}-${i}`,
    campaignName:    c.name,
    platform:        c.platform,
    spend:           c.spend,
    impressions:     c.impressions,
    clicks:          c.clicks,
    conversions:     c.conversions,
    roas:            c.roas,
    status:          'active' as const,
    goalImpressions: Math.round(c.impressions * 1.15),
    goalClicks:      Math.round(c.clicks * 1.12),
    goalSpend:       Math.round(c.spend * 1.08 * 100) / 100,
  }));
}

/** +20% uplift vs an imaginary baseline (service-led visibility story). */
export function showroomGscSeoMatrix(): ShowroomGscMatrix {
  const baseImp = 400_000;
  const uplift    = 1.2;
  const impressions = Math.round(baseImp * uplift);
  const clicks      = Math.round(impressions * 0.041);
  const nonBrand    = Math.round(impressions * 0.64);
  const avgPosition = 14.6;
  const ctrPct      = impressions > 0 ? (clicks / impressions) * 100 : 0;
  return {
    impressions,
    nonBrandImpressions: nonBrand,
    avgPosition,
    clicks,
    ctrPercent:          Math.round(ctrPct * 100) / 100,
    indexingIssues:      null,
    gscQueryRowCount:    186,
    hasGoogleConnection: true,
    cwv: {
      lcp:    2.35,
      cls:    0.06,
      fidMs:  72,
      label:  'Core Web Vitals — showroom snapshot',
    },
  };
}

export function showroomConnectedAdAccounts(): ConnectedAdAccount[] {
  const now = new Date().toISOString();
  return [
    { platform: 'meta', accountName: 'Lux Cosmetics — Meta Business', lastSyncedAt: now },
    { platform: 'google', accountName: 'Lux Cosmetics — Google Ads', lastSyncedAt: now },
    { platform: 'tiktok', accountName: 'Lux Cosmetics — TikTok Ads', lastSyncedAt: now },
  ];
}

export function showroomStrategicAppendix(locale: 'tr' | 'en'): string {
  if (locale === 'en') {
    return [
      'Paid media summary (showroom simulation, last 14 days):',
      '- meta: spend ~5,840 (simulated)',
      '- google: spend ~7,020 (simulated)',
      '- tiktok: spend ~5,110 (simulated)',
      'Latest GEO narrative (showroom): Luxury SERP footprint expanding on high-intent serum + ritual queries — treat as illustrative only.',
    ].join('\n');
  }
  return [
    'Ücretli medya özeti (showroom simülasyonu, son 14 gün):',
    '- meta: harcama ~5.840 (simüle)',
    '- google: harcama ~7.020 (simüle)',
    '- tiktok: harcama ~5.110 (simüle)',
    'GEO anlatısı (showroom): Yüksek niyetli serum + ritüel sorgularında lüks SERP görünürlüğü genişliyor — yalnızca örnektir.',
  ].join('\n');
}

export function showroomWeeklyDigest(): WeeklyDigestData {
  return {
    approvalsThisWeek:  14,
    approvalsLastWeek:  11,
    revisionsThisWeek:  22,
    aiMessagesThisWeek: 48,
    activeDaysThisWeek: 6,
    newAchievements:    3,
  };
}

export function showroomLeaderboard(currentUserId: string, displayName: string): LeaderboardEntry[] {
  const xpYou = 1800;
  const xp1   = 1650;
  const xp2   = 1520;
  const xp3   = 1380;
  const entries: LeaderboardEntry[] = [
    {
      userId:        currentUserId,
      displayName:   displayName || 'You',
      currentStreak: 9,
      totalXP:       xpYou,
      badgeCount:    12,
      level:         getLevel(xpYou).level,
    },
    {
      userId:        '00000000-0000-4000-8000-000000000101',
      displayName:   'Sofia V.',
      currentStreak: 6,
      totalXP:       xp1,
      badgeCount:    10,
      level:         getLevel(xp1).level,
    },
    {
      userId:        '00000000-0000-4000-8000-000000000102',
      displayName:   'Marcus L.',
      currentStreak: 4,
      totalXP:       xp2,
      badgeCount:    9,
      level:         getLevel(xp2).level,
    },
    {
      userId:        '00000000-0000-4000-8000-000000000103',
      displayName:   'Elena R.',
      currentStreak: 3,
      totalXP:       xp3,
      badgeCount:    8,
      level:         getLevel(xp3).level,
    },
  ];
  return entries.sort((a, b) => b.totalXP - a.totalXP);
}

export function showroomRecentActivity(): ActivityItem[] {
  const t = new Date().toISOString();
  return [
    {
      id:          'showroom-act-1',
      type:        'system',
      description: 'Showroom · Gold Cream Launch crossed 900k impressions (simulated).',
      createdAt:   t,
    },
    {
      id:          'showroom-act-2',
      type:        'creative',
      description: 'Creative "Night Serum Ritual UGC" — status: approved',
      createdAt:   t,
    },
    {
      id:          'showroom-act-3',
      type:        'report',
      description: 'GEO pulse refreshed — luxury SERP visibility trending +18% WoW (simulated).',
      createdAt:   t,
    },
  ];
}
