'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import type { PlatformMetrics, ChartDataPoint, CampaignRow, ActivityItem, AggregateMetrics } from '../types';

export type TimeRange = 'daily' | 'weekly' | 'monthly';

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

async function aggregateMetrics(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  from: string,
  to: string
) {
  const { data } = await supabase
    .from('daily_metrics')
    .select('platform, spend, impressions, clicks, conversions, roas, ctr')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lte('date', to);

  const byPlatform: Record<string, { spend: number; impressions: number; clicks: number; conversions: number; roas: number; ctr: number; count: number }> = {};

  for (const row of data ?? []) {
    const p = row.platform as string;
    if (!byPlatform[p]) byPlatform[p] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0, ctr: 0, count: 0 };
    byPlatform[p].spend       += Number(row.spend);
    byPlatform[p].impressions += Number(row.impressions);
    byPlatform[p].clicks      += Number(row.clicks);
    byPlatform[p].conversions += Number(row.conversions);
    byPlatform[p].roas        += Number(row.roas);
    byPlatform[p].ctr         += Number(row.ctr);
    byPlatform[p].count       += 1;
  }

  return byPlatform;
}

export async function fetchAggregateMetrics(
  companyId: string,
  range: TimeRange = 'monthly'
): Promise<AggregateMetrics> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();
  const { current, previous } = dateRangeFor(range);

  const [cur, prev] = await Promise.all([
    aggregateMetrics(supabase, validatedId, current.from, current.to),
    aggregateMetrics(supabase, validatedId, previous.from, previous.to),
  ]);

  const sumAll = (agg: typeof cur, field: keyof (typeof cur)[string]) =>
    Object.values(agg).reduce((s, v) => s + (v as Record<string, number>)[field as string], 0);

  const avgAll = (agg: typeof cur, field: 'roas' | 'ctr') => {
    const vals = Object.values(agg);
    if (!vals.length) return 0;
    return vals.reduce((s, v) => s + (v[field] / (v.count || 1)), 0) / vals.length;
  };

  const mk = (c: number, p: number) => ({
    current:  c,
    previous: p,
    change:   p > 0 ? ((c - p) / p) * 100 : 0,
  });

  const curSpend       = sumAll(cur,  'spend');
  const curConversions = sumAll(cur,  'conversions');
  const curClicks      = sumAll(cur,  'clicks');
  const prevSpend      = sumAll(prev, 'spend');
  const prevConversions= sumAll(prev, 'conversions');
  const prevClicks     = sumAll(prev, 'clicks');

  return {
    spend:           mk(curSpend, prevSpend),
    impressions:     mk(sumAll(cur, 'impressions'), sumAll(prev, 'impressions')),
    clicks:          mk(curClicks, prevClicks),
    conversions:     mk(curConversions, prevConversions),
    roas:            mk(avgAll(cur, 'roas'), avgAll(prev, 'roas')),
    cpa:             mk(
      curConversions  > 0 ? curSpend / curConversions   : 0,
      prevConversions > 0 ? prevSpend / prevConversions  : 0,
    ),
    conversionRate:  mk(
      curClicks  > 0 ? (curConversions  / curClicks)  * 100 : 0,
      prevClicks > 0 ? (prevConversions / prevClicks) * 100 : 0,
    ),
    hasData: Object.keys(cur).length > 0,
    dateRange: current,
  };
}

export async function fetchPlatformMetrics(companyId: string, range: TimeRange = 'monthly'): Promise<PlatformMetrics[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();
  const { current, previous } = dateRangeFor(range);

  const [cur, prev] = await Promise.all([
    aggregateMetrics(supabase, validatedId, current.from, current.to),
    aggregateMetrics(supabase, validatedId, previous.from, previous.to),
  ]);

  const platforms = Array.from(new Set([...Object.keys(cur), ...Object.keys(prev)])) as Array<'meta' | 'google' | 'tiktok'>;
  if (!platforms.length) return [];

  return platforms.map((platform) => {
    const c = cur[platform]  ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0, ctr: 0, count: 0 };
    const p = prev[platform] ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0, ctr: 0, count: 0 };
    const mk = (cv: number, pv: number) => ({ current: cv, previous: pv, change: pv > 0 ? ((cv - pv) / pv) * 100 : 0 });

    return {
      platform,
      spend:       mk(c.spend, p.spend),
      impressions: mk(c.impressions, p.impressions),
      clicks:      mk(c.clicks, p.clicks),
      conversions: mk(c.conversions, p.conversions),
      roas:        mk(c.count > 0 ? c.roas / c.count : 0, p.count > 0 ? p.roas / p.count : 0),
      ctr:         mk(c.count > 0 ? c.ctr  / c.count : 0, p.count > 0 ? p.ctr  / p.count : 0),
    };
  });
}

export async function fetchSpendChartData(companyId: string, range: TimeRange = 'monthly'): Promise<ChartDataPoint[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();

  let days = 14;
  if (range === 'weekly')  days = 84;
  if (range === 'monthly') days = 365;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data, error } = await supabase
    .from('daily_metrics')
    .select('date, platform, spend')
    .eq('tenant_id', validatedId)
    .gte('date', fromDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error || !data?.length) return [];

  if (range === 'daily' || (range === 'weekly' && days <= 14)) {
    const byDate: Record<string, ChartDataPoint> = {};
    for (const row of data) {
      const label = new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byDate[row.date]) byDate[row.date] = { date: label, meta: 0, google: 0, tiktok: 0 };
    (byDate[row.date] as unknown as Record<string, number>)[row.platform] = Number(row.spend);
    }
    return Object.values(byDate);
  }

  // For weekly/monthly: group into weeks
  const byWeek: Record<string, ChartDataPoint> = {};
  for (const row of data) {
    const d = new Date(row.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key   = weekStart.toISOString().split('T')[0];
    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byWeek[key]) byWeek[key] = { date: label, meta: 0, google: 0, tiktok: 0 };
    (byWeek[key] as unknown as Record<string, number>)[row.platform] = ((byWeek[key] as unknown as Record<string, number>)[row.platform] ?? 0) + Number(row.spend);
  }
  return Object.values(byWeek);
}

export async function fetchCampaigns(companyId: string): Promise<CampaignRow[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('ad_campaigns')
    .select('id, campaign_name, platform, data, goal_impressions, goal_clicks, goal_spend')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data?.length) return [];

  return data.map((c) => {
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
