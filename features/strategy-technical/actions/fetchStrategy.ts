'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import type { GeoReport, RoadmapItem, MarketInsight, SeoGeoDashboardData, SeoLogPayload, GeoAiKeywordRow } from '../types';
import type { GeoStrategyLogContent } from '@/features/strategy/types';
import { auth } from '@/lib/auth/config';
import { isDemoTenant } from '@/lib/demo/is-demo-tenant';
import type { SessionUser } from '@/types/user';
import { deepseekChatModel, parseDeepseekJson } from '@/lib/ai/deepseek-model';

/** Viewer's page language — AI narratives must match it. */
async function viewerLocale(): Promise<'tr' | 'en'> {
  const session = await auth();
  return (session?.user as SessionUser | undefined)?.locale === 'en' ? 'en' : 'tr';
}

function pickNum(obj: Record<string, unknown> | null | undefined, keys: string[]): number {
  if (!obj) return 0;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return 0;
}

function pickStr(obj: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function parseSeoRow(content: unknown): {
  impressions: number;
  visits: number;
  ctr: number;
  avgPosition: number;
  aiInsight: string | null;
  cwv: SeoLogPayload['coreWebVitals'] | undefined;
} {
  const c = (content && typeof content === 'object' ? content : {}) as Record<string, unknown>;
  const nested = c.coreWebVitals as SeoLogPayload['coreWebVitals'] | undefined;
  return {
    impressions: pickNum(c, ['totalImpressions', 'impressions']),
    visits:      pickNum(c, ['visits', 'sessions']),
    ctr:         pickNum(c, ['ctr']),
    avgPosition: pickNum(c, ['averagePosition', 'avgPosition', 'avg_position']),
    aiInsight:   pickStr(c, ['aiInsight', 'aiSummary', 'summary']),
    cwv:         nested,
  };
}

function mkMetric(current: number, previous: number) {
  return {
    current,
    previous,
    change: previous > 0 ? ((current - previous) / previous) * 100 : current > 0 && previous === 0 ? 100 : 0,
  };
}

/** Map raw CWV to 0–100 ring fill (higher = healthier). */
function scoreLcp(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds <= 2.5) return 100;
  if (seconds <= 4) return Math.max(35, 100 - (seconds - 2.5) * 35);
  return Math.max(12, 45 - (seconds - 4) * 10);
}

function scoreFid(ms: number): number {
  if (ms <= 0) return 0;
  if (ms <= 100) return 100;
  if (ms <= 300) return Math.max(30, 100 - (ms - 100) * 0.35);
  return Math.max(10, 65 - (ms - 300) * 0.08);
}

function scoreCls(v: number): number {
  if (v < 0) return 0;
  if (v <= 0.1) return 100;
  if (v <= 0.25) return Math.max(35, 100 - (v - 0.1) * 400);
  return Math.max(12, 55 - (v - 0.25) * 80);
}

function cwvFromPayload(cwv: SeoLogPayload['coreWebVitals'] | undefined): SeoGeoDashboardData['cwv'] | null {
  if (!cwv) return null;
  const lcpRaw = cwv.lcpSeconds ?? (cwv.lcp != null && cwv.lcp > 20 ? cwv.lcp / 1000 : cwv.lcp) ?? 0;
  const fidRaw = cwv.fidMs ?? cwv.fid ?? 0;
  const clsRaw = cwv.cls ?? 0;
  if (!lcpRaw && !fidRaw && !clsRaw) return null;
  return {
    lcp: scoreLcp(lcpRaw || 4),
    fid: scoreFid(fidRaw || 200),
    cls: scoreCls(clsRaw || 0.15),
    lcpRaw: lcpRaw || undefined,
    fidRaw: fidRaw || undefined,
    clsRaw: clsRaw || undefined,
  };
}

function cwvFromTechnicalMetadata(meta: unknown): SeoGeoDashboardData['cwv'] | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  if (m.source !== 'pagespeed_simulation') return null;
  const lcpRaw = Number(m.lcpSeconds ?? m.lcp ?? 0);
  const fidRaw = Number(m.fidMs ?? m.fid ?? 0);
  const clsRaw = Number(m.cls ?? 0);
  if (!lcpRaw && !fidRaw && !clsRaw) return null;
  return {
    lcp: scoreLcp(lcpRaw || 4),
    fid: scoreFid(fidRaw || 200),
    cls: scoreCls(clsRaw || 0.15),
    lcpRaw: lcpRaw || undefined,
    fidRaw: fidRaw || undefined,
    clsRaw: clsRaw || undefined,
  };
}

async function loadGeoReportsForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<GeoReport[]> {
  const { data, error } = await supabase
    .from('geo_reports')
    .select('id, keyword, engine, rank_data, created_at, metric_source')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[loadGeoReportsForTenant]', error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((r) => {
    const ms = (r as { metric_source?: string }).metric_source;
    let metricSource: GeoReport['metricSource'] = 'geo_rank';
    if (ms === 'gsc_query') metricSource = 'gsc_query';
    if (ms === 'geo_ai') metricSource = 'geo_ai';
    return {
      id:           r.id,
      keyword:      r.keyword,
      engine:       r.engine as GeoReport['engine'],
      metricSource,
      rankData:     r.rank_data as GeoReport['rankData'],
      createdAt:    r.created_at,
    };
  });
}

export async function fetchGeoReports(companyId: string): Promise<GeoReport[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();
  return loadGeoReportsForTenant(supabase, validatedId);
}

export async function fetchRoadmap(companyId: string): Promise<RoadmapItem[]> {
  const validatedId = await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('roadmap_milestones')
    .select('id, title, description, status, category, eta, eta_date, created_at')
    .eq('tenant_id', validatedId)
    .order('eta_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('[fetchRoadmap]', error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((r) => ({
    id:          r.id,
    title:       r.title,
    description: r.description ?? '',
    status:      r.status as RoadmapItem['status'],
    category:    r.category as RoadmapItem['category'],
    eta:         r.eta ?? (r.eta_date ? new Date(r.eta_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '—'),
    etaDate:     r.eta_date,
  }));
}

export async function fetchMarketInsight(
  companyId: string,
  tenantName: string
): Promise<MarketInsight | null> {
  const validatedId = await requireTenantAction(companyId);
  const locale = await viewerLocale();

  const supabase = await createSupabaseServerClient();

  // Cached per language, so a TR viewer and an EN viewer each get their own.
  const reportType = `market_insight_${locale}`;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await supabase
    .from('strategy_logs')
    .select('content, generated_at')
    .eq('tenant_id', validatedId)
    .eq('report_type', reportType)
    .gte('generated_at', oneDayAgo)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.content) {
    return cached.content as MarketInsight;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  // ── Ground the insight in what is actually measured for this tenant ──────
  // An "insight" written from nothing but the brand name is fabrication; if no
  // real signal exists, the honest answer is the empty state, not a guess.
  const [gscAgg, ga4, competitors] = await Promise.all([
    supabase
      .from('geo_reports')
      .select('rank_data')
      .eq('tenant_id', validatedId)
      .eq('metric_source', 'gsc_query')
      .limit(500),
    supabase
      .from('ga4_daily_metrics')
      .select('sessions, conversions, revenue')
      .eq('tenant_id', validatedId),
    supabase
      .from('competitors')
      .select('name, url')
      .eq('tenant_id', validatedId)
      .eq('is_active', true)
      .limit(10),
  ]);

  let gscImpressions = 0;
  let gscClicks = 0;
  const topQueries: Array<{ query: string; impressions: number; position: number }> = [];
  for (const row of gscAgg.data ?? []) {
    const rd = row.rank_data as Record<string, unknown> | null;
    const im = Number(rd?.impressions ?? 0);
    gscImpressions += im;
    gscClicks += Number(rd?.clicks ?? 0);
    if (typeof rd?.query === 'string' && im > 0) {
      topQueries.push({ query: rd.query, impressions: im, position: Number(rd?.position ?? 0) });
    }
  }
  topQueries.sort((a, b) => b.impressions - a.impressions);

  let ga4Sessions = 0;
  let ga4Conversions = 0;
  for (const row of ga4.data ?? []) {
    ga4Sessions += Number((row as { sessions?: number }).sessions ?? 0);
    ga4Conversions += Number((row as { conversions?: number }).conversions ?? 0);
  }

  const { data: spendRows } = await supabase
    .from('daily_metrics')
    .select('platform, spend, revenue')
    .eq('tenant_id', validatedId)
    .limit(1000);

  const paid: Record<string, { spend: number; revenue: number }> = {};
  for (const r of spendRows ?? []) {
    const plat = String((r as { platform?: string }).platform ?? '');
    if (!plat || plat === 'organic') continue;
    paid[plat] = paid[plat] ?? { spend: 0, revenue: 0 };
    paid[plat].spend += Number((r as { spend?: number }).spend ?? 0);
    paid[plat].revenue += Number((r as { revenue?: number }).revenue ?? 0);
  }

  const competitorNames = (competitors.data ?? []).map((c) => (c as { name: string }).name);

  const hasSignal =
    gscImpressions > 0 ||
    ga4Sessions > 0 ||
    Object.keys(paid).length > 0 ||
    competitorNames.length > 0;

  // Showroom tenants are allowed illustrative content; real tenants are not.
  const demo = await isDemoTenant(validatedId);
  if (!hasSignal && !demo) return null;

  const facts = {
    organicSearch:
      gscImpressions > 0
        ? { impressions: gscImpressions, clicks: gscClicks, topQueries: topQueries.slice(0, 8) }
        : null,
    siteAnalytics: ga4Sessions > 0 ? { sessions: ga4Sessions, conversions: ga4Conversions } : null,
    paidChannels: Object.keys(paid).length > 0 ? paid : null,
    trackedCompetitors: competitorNames.length > 0 ? competitorNames : null,
  };

  const langLine =
    locale === 'en'
      ? 'Write EVERY string value in natural, clear ENGLISH.'
      : 'Write EVERY string value in natural, clear TURKISH.';

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: deepseekChatModel(),
        messages: [
          {
            role: 'system',
            content:
              'You are a senior digital marketing strategist. You analyse ONLY the measured data you are given. ' +
              'Never invent metrics, market claims, or competitor moves that are not in the data. ' +
              'If a data source is null, do not speculate about it. ' +
              'Avoid marketing buzzwords; plain professional language. Respond with JSON only.',
          },
          {
            role: 'user',
            content:
              `Brand: "${tenantName}". ${langLine}\n\n` +
              `Measured data (last sync window):\n${JSON.stringify(facts, null, 2)}\n\n` +
              'Return a JSON object with exactly these fields: ' +
              '{ "summary": string (2-3 sentences grounded in the data above), ' +
              '"opportunities": string[] (up to 3, each tied to a specific number or query in the data), ' +
              '"threats": string[] (up to 2, only if the data supports them — empty array otherwise), ' +
              '"geoRecommendation": string (GEO/AI-visibility step based on the actual top queries), ' +
              '"confidence": number (0-100 — LOW when few data sources are present) }',
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      console.error('[fetchMarketInsight] DeepSeek API error:', response.status);
      return null;
    }

    const json = await response.json();
    const content = parseDeepseekJson<MarketInsight>(json?.choices?.[0]?.message?.content);
    if (!content) {
      console.error('[fetchMarketInsight] could not parse model JSON');
      return null;
    }

    await supabase.from('strategy_logs').insert({
      tenant_id:    validatedId,
      report_type:  reportType,
      content,
      generated_at: new Date().toISOString(),
    });

    return content;
  } catch (err) {
    console.error('[fetchMarketInsight]', err);
    return null;
  }
}

async function computeSeoGeoDashboard(validatedId: string): Promise<SeoGeoDashboardData> {
  const supabase = await createSupabaseServerClient();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [geoReports, seoLogs, techLogs, cwvLogs, gscPages, geoStratRow, geoAiRows] = await Promise.all([
    loadGeoReportsForTenant(supabase, validatedId),
    supabase
      .from('strategy_logs')
      .select('content, generated_at')
      .eq('tenant_id', validatedId)
      .eq('report_type', 'seo')
      .order('generated_at', { ascending: false })
      .limit(2),
    supabase
      .from('technical_logs')
      .select('id, description, metadata, created_at')
      .eq('tenant_id', validatedId)
      .gte('created_at', since)
      .limit(400),
    supabase
      .from('technical_logs')
      .select('metadata, created_at')
      .eq('tenant_id', validatedId)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('gsc_page_analytics').select('clicks').eq('tenant_id', validatedId),
    supabase
      .from('strategy_logs')
      .select('content, generated_at')
      .eq('tenant_id', validatedId)
      .eq('report_type', 'geo_strategy')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('geo_reports')
      .select('keyword, rank_data')
      .eq('tenant_id', validatedId)
      .eq('metric_source', 'geo_ai')
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  const reports = geoReports;
  const geoRankOnly = reports.filter(
    (r) => r.metricSource !== 'gsc_query' && r.metricSource !== 'geo_ai'
  );
  const gscRows = reports.filter((r) => r.metricSource === 'gsc_query');

  const cited = geoRankOnly.filter((r) => r.rankData.cited).length;
  const withPos = geoRankOnly.filter((r) => r.rankData.position !== null);
  const avgGeoPos =
    withPos.length > 0
      ? withPos.reduce((s, r) => s + (r.rankData.position ?? 0), 0) / withPos.length
      : null;

  const rows = seoLogs.data ?? [];
  const latest = rows[0]?.content ? parseSeoRow(rows[0].content) : null;
  const prev = rows[1]?.content ? parseSeoRow(rows[1].content) : null;

  const cur = latest ?? { impressions: 0, visits: 0, ctr: 0, avgPosition: 0, aiInsight: null as string | null, cwv: undefined };
  const pre = prev ?? { impressions: 0, visits: 0, ctr: 0, avgPosition: 0, aiInsight: null as string | null, cwv: undefined };

  let gscImp = 0;
  let gscClk = 0;
  let posW = 0;
  let posSum = 0;
  for (const r of gscRows) {
    const im = r.rankData.impressions ?? 0;
    const cl = r.rankData.clicks ?? 0;
    const po = r.rankData.position ?? 0;
    gscImp += im;
    gscClk += cl;
    posW += im;
    posSum += po * im;
  }
  const gscCtr      = gscImp > 0 ? (gscClk / gscImp) * 100 : 0;
  const gscAvgPos   = posW > 0 ? posSum / posW : 0;
  const pageClicks  = (gscPages.data ?? []).reduce((s, p) => s + (p.clicks ?? 0), 0);

  const seo =
    gscRows.length > 0
      ? {
          impressions: mkMetric(gscImp, pre.impressions),
          visits:      mkMetric(pageClicks > 0 ? pageClicks : gscClk, pre.visits),
          ctr:         mkMetric(gscCtr, pre.ctr),
          avgPosition: mkMetric(gscAvgPos, pre.avgPosition),
        }
      : {
          impressions: mkMetric(cur.impressions, pre.impressions),
          visits:      mkMetric(cur.visits, pre.visits),
          ctr:         mkMetric(cur.ctr, pre.ctr),
          avgPosition: mkMetric(cur.avgPosition, pre.avgPosition),
        };

  const aiInsight = latest?.aiInsight ?? null;

  const errorCount = (techLogs.data ?? []).filter((log) => {
    const meta = log.metadata as Record<string, unknown> | null;
    const sev = meta?.severity === 'error' || meta?.level === 'error' || meta?.error === true;
    return sev || /error|failed|critical/i.test(log.description);
  }).length;

  const simCwv = (cwvLogs.data ?? [])
    .map((l) => cwvFromTechnicalMetadata(l.metadata))
    .find((c) => c != null);

  const locale = await viewerLocale();
  const strat = geoStratRow.data?.content as GeoStrategyLogContent | null | undefined;
  // Serve the narrative in the viewer's language when the English pass exists.
  const localized =
    strat && locale === 'en' && strat.en
      ? {
          ...strat,
          headline: strat.en.headline,
          summary: strat.en.summary,
          sentimentAndCitations: strat.en.sentimentAndCitations,
          geoGapAnalysis: strat.en.geoGapAnalysis,
          globalActionPlan: strat.en.globalActionPlan,
        }
      : strat;
  const geoStrategy =
    localized && geoStratRow.data?.generated_at
      ? { ...localized, logGeneratedAt: geoStratRow.data.generated_at }
      : null;

  const geoAiKeywords: GeoAiKeywordRow[] = (geoAiRows.data ?? []).map((row) => {
    const rd = row.rank_data as GeoReport['rankData'];
    return {
      keyword:         row.keyword,
      visibilityScore: rd.visibilityScore ?? 0,
      actionableSteps:
        locale === 'en' && (rd as { actionableStepsEn?: string | null }).actionableStepsEn
          ? String((rd as { actionableStepsEn?: string | null }).actionableStepsEn)
          : rd.actionableSteps ?? '',
      gscImpressions:  rd.gscImpressions ?? undefined,
      gscClicks:       rd.gscClicks ?? undefined,
      gscPosition:     rd.gscPosition ?? undefined,
    };
  });

  return {
    geoReports: reports,
    geoStrategy,
    geoAiKeywords,
    geo: {
      serviceVisibilityPct: geoRankOnly.length ? (cited / geoRankOnly.length) * 100 : 0,
      avgPosition: avgGeoPos,
      trackedKeywords: geoRankOnly.length + gscRows.length,
    },
    seo,
    cwv: cwvFromPayload(latest?.cwv) ?? simCwv ?? null,
    errorCount,
    aiInsight: aiInsight ?? null,
  };
}

export async function fetchSeoGeoDashboard(companyId: string): Promise<SeoGeoDashboardData> {
  const validatedId = await requireTenantAction(companyId);
  // Not using unstable_cache: Supabase server client reads cookies() — incompatible with cache scope.
  // GEO/GSC views stay live against Postgres so high-ticket users see sync state, not a stale 1h CDN snapshot.
  return computeSeoGeoDashboard(validatedId);
}
