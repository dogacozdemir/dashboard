'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import type {
  Platform,
  PlatformMetrics,
  ChartDataPoint,
  CampaignRow,
  ActivityItem,
  AggregateMetrics,
  ConnectedAdAccount,
} from '../types';
import type { CockpitPlatform } from '../lib/cockpit-platform';
import { dailyMetricPlatformsFilter } from '../lib/cockpit-platform';

export type TimeRange = 'daily' | 'weekly' | 'monthly';

export interface ExecutiveTrendPoint {
  date: string;
  spend: number;
  revenue: number;
}

export interface GscSeoMatrixData {
  impressions: number;
  nonBrandImpressions: number;
  avgPosition: number;
  clicks: number;
  ctrPercent: number;
  /** Requires Search Console Indexing API wiring — null until ingested. */
  indexingIssues: number | null;
  cwv: {
    lcp: number | null;
    cls: number | null;
    fidMs: number | null;
    label: string | null;
  };
}

export interface PlatformComparisonRow {
  platform: Platform;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  conversions: number;
}

function dateRangeFor(range: TimeRange): { current: { from: string; to: string }; previous: { from: string; to: string } } {
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

type PlatformAgg = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  ctr: number;
  count: number;
  revenue: number;
};

type RpcAggRow = {
  platform: string;
  spend: string | number;
  impressions: string | number;
  clicks: string | number;
  conversions: string | number;
  roas_sum: string | number;
  ctr_sum: string | number;
  row_count: string | number;
  revenue: string | number;
};

function filterAggByCockpit(
  byPlatform: Record<string, PlatformAgg>,
  cockpit: CockpitPlatform,
): Record<string, PlatformAgg> {
  const pf = dailyMetricPlatformsFilter(cockpit);
  if (!pf) return byPlatform;
  const out: Record<string, PlatformAgg> = {};
  for (const p of pf) {
    if (byPlatform[p]) out[p] = byPlatform[p];
  }
  return out;
}

async function aggregateMetrics(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  from: string,
  to: string,
  cockpit: CockpitPlatform = 'all',
): Promise<{ byPlatform: Record<string, PlatformAgg>; totalRevenue: number }> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('aggregate_daily_metrics_range', {
    p_tenant_id: tenantId,
    p_from:      from,
    p_to:        to,
  });

  if (!rpcErr && rpcData != null && Array.isArray(rpcData)) {
    const byPlatformFull: Record<string, PlatformAgg> = {};
    let totalRevenueFull = 0;
    for (const raw of rpcData as RpcAggRow[]) {
      const p = raw.platform;
      const rev = Number(raw.revenue);
      totalRevenueFull += rev;
      byPlatformFull[p] = {
        spend:       Number(raw.spend),
        impressions: Number(raw.impressions),
        clicks:      Number(raw.clicks),
        conversions: Number(raw.conversions),
        roas:        Number(raw.roas_sum),
        ctr:         Number(raw.ctr_sum),
        count:       Number(raw.row_count),
        revenue:     rev,
      };
    }
    const byPlatform = filterAggByCockpit(byPlatformFull, cockpit);
    const totalRevenue = Object.values(byPlatform).reduce((s, v) => s + v.revenue, 0);
    return { byPlatform, totalRevenue };
  }

  if (rpcErr) {
    console.warn('[aggregateMetrics] rpc unavailable, row scan fallback:', rpcErr.message);
  }

  let q = supabase
    .from('daily_metrics')
    .select('platform, spend, impressions, clicks, conversions, roas, ctr')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lte('date', to);

  const pf = dailyMetricPlatformsFilter(cockpit);
  if (pf) q = q.in('platform', pf);

  const { data } = await q;

  const byPlatform: Record<string, PlatformAgg> = {};
  let totalRevenue = 0;

  for (const row of data ?? []) {
    const p = row.platform as string;
    const spend = Number(row.spend);
    const roas = Number(row.roas);
    const rowRevenue = spend * roas;
    totalRevenue += rowRevenue;

    if (!byPlatform[p]) {
      byPlatform[p] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0, ctr: 0, count: 0, revenue: 0 };
    }
    byPlatform[p].spend       += spend;
    byPlatform[p].impressions += Number(row.impressions);
    byPlatform[p].clicks      += Number(row.clicks);
    byPlatform[p].conversions += Number(row.conversions);
    byPlatform[p].roas        += roas;
    byPlatform[p].ctr         += Number(row.ctr);
    byPlatform[p].count       += 1;
    byPlatform[p].revenue     += rowRevenue;
  }

  return { byPlatform, totalRevenue };
}

const sumAll = (agg: Record<string, PlatformAgg>, field: keyof PlatformAgg) =>
  Object.values(agg).reduce((s, v) => s + v[field], 0);

const avgRoas = (agg: Record<string, PlatformAgg>) => {
  const entries = Object.entries(agg).filter(([k]) => k !== 'organic');
  if (!entries.length) return 0;
  return entries.reduce((s, [, v]) => s + (v.roas / (v.count || 1)), 0) / entries.length;
};

const blendedCtr = (agg: Record<string, PlatformAgg>) => {
  const imps = sumAll(agg, 'impressions');
  const clk = sumAll(agg, 'clicks');
  return imps > 0 ? (clk / imps) * 100 : 0;
};

const mkDelta = (c: number, p: number) => ({
  current:  c,
  previous: p,
  change:   p > 0 ? ((c - p) / p) * 100 : (c > 0 && p === 0 ? 100 : 0),
});

async function computeAggregateMetrics(
  tenantId: string,
  range: TimeRange,
  cockpit: CockpitPlatform = 'all',
): Promise<AggregateMetrics> {
  const supabase = await createSupabaseServerClient();
  const { current, previous } = dateRangeFor(range);

  const [cur, prev] = await Promise.all([
    aggregateMetrics(supabase, tenantId, current.from, current.to, cockpit),
    aggregateMetrics(supabase, tenantId, previous.from, previous.to, cockpit),
  ]);

  const curSpend        = sumAll(cur.byPlatform, 'spend');
  const curConversions  = sumAll(cur.byPlatform, 'conversions');
  const curClicks       = sumAll(cur.byPlatform, 'clicks');
  const curImpressions  = sumAll(cur.byPlatform, 'impressions');
  const prevSpend       = sumAll(prev.byPlatform, 'spend');
  const prevConversions = sumAll(prev.byPlatform, 'conversions');
  const prevClicks      = sumAll(prev.byPlatform, 'clicks');
  const prevImpressions = sumAll(prev.byPlatform, 'impressions');

  return {
    spend:          mkDelta(curSpend, prevSpend),
    revenue:        mkDelta(cur.totalRevenue, prev.totalRevenue),
    impressions:    mkDelta(curImpressions, prevImpressions),
    clicks:         mkDelta(curClicks, prevClicks),
    conversions:    mkDelta(curConversions, prevConversions),
    roas:           mkDelta(avgRoas(cur.byPlatform), avgRoas(prev.byPlatform)),
    cpa: mkDelta(
      curConversions  > 0 ? curSpend / curConversions  : 0,
      prevConversions > 0 ? prevSpend / prevConversions : 0,
    ),
    ctr: mkDelta(blendedCtr(cur.byPlatform), blendedCtr(prev.byPlatform)),
    conversionRate: mkDelta(
      curClicks  > 0 ? (curConversions / curClicks) * 100 : 0,
      prevClicks > 0 ? (prevConversions / prevClicks) * 100 : 0,
    ),
    hasData:   Object.keys(cur.byPlatform).length > 0,
    dateRange: current,
  };
}

async function computePlatformMetrics(
  tenantId: string,
  range: TimeRange,
  cockpit: CockpitPlatform = 'all',
): Promise<PlatformMetrics[]> {
  if (cockpit === 'seo') return [];

  const supabase = await createSupabaseServerClient();
  const { current, previous } = dateRangeFor(range);

  const [cur, prev] = await Promise.all([
    aggregateMetrics(supabase, tenantId, current.from, current.to, cockpit),
    aggregateMetrics(supabase, tenantId, previous.from, previous.to, cockpit),
  ]);

  let platforms = Array.from(
    new Set([...Object.keys(cur.byPlatform), ...Object.keys(prev.byPlatform)])
  ).filter((p) => p !== 'organic') as Array<'meta' | 'google' | 'tiktok'>;

  if (cockpit !== 'all') {
    platforms = platforms.filter((p) => p === cockpit);
  }

  if (!platforms.length) return [];

  const empty: PlatformAgg = {
    spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0, ctr: 0, count: 0, revenue: 0,
  };

  return platforms.map((platform) => {
    const c = cur.byPlatform[platform]  ?? { ...empty };
    const p = prev.byPlatform[platform] ?? { ...empty };
    const mk = (cv: number, pv: number) => ({
      current: cv,
      previous: pv,
      change: pv > 0 ? ((cv - pv) / pv) * 100 : (cv > 0 && pv === 0 ? 100 : 0),
    });

    const roasC = c.count > 0 ? c.roas / c.count : 0;
    const roasP = p.count > 0 ? p.roas / p.count : 0;
    const ctrC = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    const ctrP = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;

    return {
      platform,
      spend:       mk(c.spend, p.spend),
      impressions: mk(c.impressions, p.impressions),
      clicks:      mk(c.clicks, p.clicks),
      conversions: mk(c.conversions, p.conversions),
      roas:        mk(roasC, roasP),
      ctr:         mk(ctrC, ctrP),
    };
  });
}

export async function fetchAggregateMetrics(
  companyId: string,
  range: TimeRange = 'monthly',
  cockpit: CockpitPlatform = 'all',
): Promise<AggregateMetrics> {
  const validatedId = await requireTenantAction(companyId);
  return computeAggregateMetrics(validatedId, range, cockpit);
}

export async function fetchPlatformMetrics(
  companyId: string,
  range: TimeRange = 'monthly',
  cockpit: CockpitPlatform = 'all',
): Promise<PlatformMetrics[]> {
  const validatedId = await requireTenantAction(companyId);
  return computePlatformMetrics(validatedId, range, cockpit);
}

export async function fetchPlatformComparison(
  companyId: string,
  range: TimeRange = 'monthly',
  cockpit: CockpitPlatform = 'all',
): Promise<PlatformComparisonRow[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();
  const { current } = dateRangeFor(range);

  const { byPlatform } = await aggregateMetrics(
    supabase,
    validatedId,
    current.from,
    current.to,
    cockpit === 'seo' ? 'all' : cockpit,
  );

  if (cockpit === 'seo') return [];

  let platforms = (['meta', 'google', 'tiktok'] as const).filter(
    (p) =>
      byPlatform[p] &&
      (byPlatform[p].spend > 0 ||
        byPlatform[p].impressions > 0 ||
        byPlatform[p].clicks > 0),
  );

  if (cockpit !== 'all') {
    platforms = platforms.filter((p) => p === cockpit);
  }

  return platforms.map((platform) => {
    const v = byPlatform[platform];
    const roas = v.count > 0 ? v.roas / v.count : 0;
    const cpa = v.conversions > 0 ? v.spend / v.conversions : 0;
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

async function computeExecutiveTrend(
  tenantId: string,
  range: TimeRange,
  cockpit: CockpitPlatform,
): Promise<ExecutiveTrendPoint[]> {
  const supabase = await createSupabaseServerClient();

  let days = 14;
  if (range === 'weekly') days = 84;
  if (range === 'monthly') days = 365;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split('T')[0];

  let q = supabase
    .from('daily_metrics')
    .select('date, spend, roas, platform')
    .eq('tenant_id', tenantId)
    .gte('date', fromStr)
    .order('date', { ascending: true });

  if (cockpit === 'all') {
    q = q.in('platform', ['meta', 'google', 'tiktok']);
  } else {
    const pf = dailyMetricPlatformsFilter(cockpit);
    if (!pf || cockpit === 'seo') return [];
    q = q.in('platform', pf as unknown as ('meta' | 'google' | 'tiktok')[]);
  }

  const { data, error } = await q;
  if (error || !data?.length) return [];

  const byDate: Record<string, { spend: number; revenue: number }> = {};
  for (const row of data) {
    const spend   = Number(row.spend);
    const revenue = spend * Number(row.roas);
    if (!byDate[row.date]) byDate[row.date] = { spend: 0, revenue: 0 };
    byDate[row.date].spend += spend;
    byDate[row.date].revenue += revenue;
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, spend: v.spend, revenue: v.revenue }));
}

export async function fetchExecutiveTrend(
  companyId: string,
  range: TimeRange = 'monthly',
  cockpit: CockpitPlatform = 'all',
): Promise<ExecutiveTrendPoint[]> {
  const validatedId = await requireTenantAction(companyId);
  return computeExecutiveTrend(validatedId, range, cockpit);
}

function tokenizeBrand(name: string | null): string[] {
  if (!name?.trim()) return [];
  return name
    .toLowerCase()
    .split(/[^a-z0-9ğüşöçıı]+/i)
    .filter((t) => t.length >= 3);
}

export async function fetchGscSeoMatrix(
  companyId: string,
  tenantBrandName: string | null,
): Promise<GscSeoMatrixData> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();

  const { data: gscRows } = await supabase
    .from('geo_reports')
    .select('rank_data')
    .eq('tenant_id', validatedId)
    .eq('metric_source', 'gsc_query');

  const tokens = tokenizeBrand(tenantBrandName);

  let impressions = 0;
  let clicks      = 0;
  let posWeighted = 0;
  let posW        = 0;
  let nonBrandImp = 0;

  for (const row of gscRows ?? []) {
    const rd = row.rank_data as Record<string, unknown>;
    const im = Number(rd.impressions ?? 0);
    const cl = Number(rd.clicks ?? 0);
    const pos = Number(rd.position ?? 0);
    const queryText = String(rd.query ?? '').toLowerCase();

    impressions += im;
    clicks += cl;
    posWeighted += pos * im;
    posW += im;

    const isBrand = tokens.length > 0 && tokens.some((t) => queryText.includes(t));
    if (!isBrand) nonBrandImp += im;
  }

  const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const avgPos = posW > 0 ? posWeighted / posW : 0;

  const { data: logs } = await supabase
    .from('technical_logs')
    .select('description, metadata')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: false })
    .limit(24);

  let lcp: number | null    = null;
  let cls: number | null    = null;
  let fidMs: number | null = null;
  let label: string | null = null;

  for (const log of logs ?? []) {
    const meta = log.metadata as Record<string, unknown> | null;
    if (!meta) continue;
    const src = String(meta.source ?? '');
    const hasLcp = meta.lcpSeconds != null || meta.lcp != null;
    if (src !== 'pagespeed_simulation' && !hasLcp) continue;
    lcp = Number(meta.lcpSeconds ?? meta.lcp ?? 0) || null;
    cls = Number(meta.cls ?? 0) || null;
    fidMs = Number(meta.fidMs ?? meta.fid ?? 0) || null;
    label = log.description?.slice(0, 120) ?? 'Core Web Vitals snapshot';
    break;
  }

  return {
    impressions,
    nonBrandImpressions: nonBrandImp,
    avgPosition:         Math.round(avgPos * 100) / 100,
    clicks,
    ctrPercent:          Math.round(ctrPct * 100) / 100,
    indexingIssues:      null,
    cwv:                 { lcp, cls, fidMs, label },
  };
}

export async function fetchConnectedAdAccounts(companyId: string): Promise<ConnectedAdAccount[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('ad_accounts')
    .select('platform, account_name, last_synced_at')
    .eq('tenant_id', validatedId)
    .eq('is_active', true)
    .order('platform', { ascending: true });

  if (error || !data?.length) return [];

  return data.map((row) => ({
    platform:     row.platform as Platform,
    accountName:  row.account_name ?? null,
    lastSyncedAt: row.last_synced_at ?? null,
  }));
}

async function computeSpendChartData(
  tenantId: string,
  range: TimeRange,
  cockpit: CockpitPlatform = 'all',
): Promise<ChartDataPoint[]> {
  if (cockpit === 'seo') return [];

  const supabase = await createSupabaseServerClient();

  let days = 14;
  if (range === 'weekly') days = 84;
  if (range === 'monthly') days = 365;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  let platforms: Array<'meta' | 'google' | 'tiktok'> = ['meta', 'google', 'tiktok'];
  if (cockpit !== 'all') {
    platforms = [cockpit as 'meta' | 'google' | 'tiktok'];
  }

  const { data, error } = await supabase
    .from('daily_metrics')
    .select('date, platform, spend')
    .eq('tenant_id', tenantId)
    .in('platform', platforms)
    .gte('date', fromDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error || !data?.length) return [];

  if (range === 'daily' || (range === 'weekly' && days <= 14)) {
    const byDate: Record<string, ChartDataPoint> = {};
    for (const row of data) {
      const label = new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!byDate[row.date]) byDate[row.date] = { date: label, meta: 0, google: 0, tiktok: 0 };
      const plat = row.platform as keyof Pick<ChartDataPoint, 'meta' | 'google' | 'tiktok'>;
      if (plat === 'meta' || plat === 'google' || plat === 'tiktok') {
        byDate[row.date][plat] = Number(row.spend);
      }
    }
    return Object.values(byDate);
  }

  const byWeek: Record<string, ChartDataPoint> = {};
  for (const row of data) {
    const d = new Date(row.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key   = weekStart.toISOString().split('T')[0];
    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byWeek[key]) byWeek[key] = { date: label, meta: 0, google: 0, tiktok: 0 };
    const plat = row.platform as 'meta' | 'google' | 'tiktok';
    byWeek[key][plat] = (byWeek[key][plat] ?? 0) + Number(row.spend);
  }
  return Object.values(byWeek);
}

export async function fetchSpendChartData(
  companyId: string,
  range: TimeRange = 'monthly',
  cockpit: CockpitPlatform = 'all',
): Promise<ChartDataPoint[]> {
  const validatedId = await requireTenantAction(companyId);
  return computeSpendChartData(validatedId, range, cockpit);
}

export async function fetchCampaigns(
  companyId: string,
  cockpit: CockpitPlatform = 'all',
): Promise<CampaignRow[]> {
  const validatedId = await requireTenantAction(companyId);
  if (cockpit === 'seo') return [];

  const supabase = await createSupabaseServerClient();

  let q = supabase
    .from('ad_campaigns')
    .select('id, campaign_name, platform, data, goal_impressions, goal_clicks, goal_spend')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (cockpit !== 'all') {
    q = q.eq('platform', cockpit);
  }

  const { data, error } = await q;

  if (error || !data?.length) return [];

  const mapped = data.map((c) => {
    const d = c.data as Record<string, number | string>;
    return {
      id:              c.id,
      campaignName:    c.campaign_name,
      platform:        c.platform as 'meta' | 'google' | 'tiktok',
      spend:           Number(d.spend ?? 0),
      impressions:     Number(d.impressions ?? 0),
      clicks:          Number(d.clicks ?? 0),
      conversions:     Number(d.conversions ?? 0),
      roas:            Number(d.roas ?? 0),
      status:          (d.status as CampaignRow['status']) ?? 'active',
      goalImpressions: c.goal_impressions ?? null,
      goalClicks:      c.goal_clicks      ?? null,
      goalSpend:       c.goal_spend       != null ? Number(c.goal_spend) : null,
    };
  });

  return mapped
    .filter((row) => row.status === 'active' && row.spend > 0)
    .slice(0, 24);
}

export async function fetchRecentActivity(companyId: string): Promise<ActivityItem[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();

  const [logsResult, creativesResult] = await Promise.all([
    supabase
      .from('technical_logs')
      .select('id, type, description, created_at')
      .eq('tenant_id', validatedId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('creative_assets')
      .select('id, title, status, created_at')
      .eq('tenant_id', validatedId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const items: ActivityItem[] = [
    ...(logsResult.data ?? []).map((log) => ({
      id:          log.id,
      type:        log.type as ActivityItem['type'],
      description: log.description,
      createdAt:   log.created_at,
    })),
    ...(creativesResult.data ?? []).map((asset) => ({
      id:          asset.id,
      type:        'creative' as ActivityItem['type'],
      description: `Creative "${asset.title}" — status: ${asset.status}`,
      createdAt:   asset.created_at,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
}
