'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { requirePermission } from '@/lib/auth/permissions';
import { ABOUT_MADMONOS_CONTEXT, ABOUT_MADMONOS_CONTEXT_COMPACT } from '@/features/strategy/content/aboutMadmonos';
import type { GeoStrategyLogContent } from '@/features/strategy/types';

interface DeepseekKeywordRow {
  keyword: string;
  visibilityScore: number;
  actionableSteps: string;
  whyGeoLags?: string;
  /** Pass-through from GSC context */
  gscImpressions?: number;
  gscClicks?: number;
  gscPosition?: number;
}

interface DeepseekGeoPayload {
  overallVisibilityScore: number;
  sentimentAndCitations: string;
  geoGapAnalysis: string;
  globalActionPlan: string;
  strategicHeadline: string;
  strategicSummary: string;
  keywords: DeepseekKeywordRow[];
}

function clampScore(n: unknown): number {
  const x = typeof n === 'number' ? n : parseFloat(String(n));
  if (!Number.isFinite(x)) return 0;
  return Math.min(100, Math.max(0, Math.round(x)));
}

export async function runGenerateGeoReportForTenant(
  tenantId: string,
  tenantName: string,
  supabase: SupabaseClient,
  opts?: { agencyContext?: 'full' | 'compact' }
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'DEEPSEEK_API_KEY not configured' };
  }

  const { data: gscRows, error: gErr } = await supabase
    .from('geo_reports')
    .select('keyword, rank_data')
    .eq('tenant_id', tenantId)
    .eq('metric_source', 'gsc_query')
    .limit(500);

  if (gErr) {
    return { success: false, error: gErr.message };
  }

  const ranked = (gscRows ?? [])
    .map((r) => {
      const rd = r.rank_data as Record<string, unknown> | null;
      const im = typeof rd?.impressions === 'number' ? rd.impressions : Number(rd?.impressions ?? 0);
      const q = typeof rd?.query === 'string' ? rd.query : r.keyword;
      return {
        keyword:       q,
        impressions:   im,
        clicks:        Number(rd?.clicks ?? 0),
        ctr:           Number(rd?.ctr ?? 0),
        position:      Number(rd?.position ?? 0),
        fullKeyword:   r.keyword,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);

  const top = ranked.slice(0, 10);
  if (!top.length) {
    return { success: true, skipped: true };
  }

  const gscContext = top.map((t) => ({
    keyword:     t.keyword,
    impressions: t.impressions,
    clicks:      t.clicks,
    ctr:         t.ctr,
    position:    t.position,
  }));

  const agencyCtx =
    opts?.agencyContext === 'full' ? ABOUT_MADMONOS_CONTEXT : ABOUT_MADMONOS_CONTEXT_COMPACT;

  const userPrompt =
    `Brand / tenant name: "${tenantName}".\n\n` +
    `Top Google Search Console queries (last sync window, by impressions):\n${JSON.stringify(gscContext, null, 2)}\n\n` +
    `Using the agency context below, simulate GEO (Generative Engine Optimization) visibility — how likely are neutral LLMs ` +
    `(ChatGPT-class, Perplexity-class) to recommend or cite this brand for these queries?\n\n` +
    `Agency context:\n${agencyCtx}\n\n` +
    `Return JSON only with this exact shape:\n` +
    `{\n` +
    `  "overallVisibilityScore": number (1-100),\n` +
    `  "sentimentAndCitations": string (2-4 sentences on brand authority, trust signals, which content types LLMs prefer to cite),\n` +
    `  "geoGapAnalysis": string (2-5 sentences: why strong SEO might still mean weak GEO / AI answers),\n` +
    `  "globalActionPlan": string (numbered actionable steps for the marketing team),\n` +
    `  "strategicHeadline": string (max 12 words, punchy),\n` +
    `  "strategicSummary": string (2-3 sentences for an executive dashboard card),\n` +
    `  "keywords": [\n` +
    `    {\n` +
    `      "keyword": string,\n` +
    `      "visibilityScore": number (1-100),\n` +
    `      "actionableSteps": string (specific steps for this query),\n` +
    `      "whyGeoLags": string (optional, one sentence)\n` +
    `    }\n` +
    `  ]\n` +
    `}\n` +
    `Include one keywords[] entry per input query (same order as given).`;

  let parsed: DeepseekGeoPayload;
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:    'deepseek-chat',
        messages: [
          {
            role:    'system',
            content:
              'You are Madmonos GEO Intelligence — an expert in Generative Engine Optimization. ' +
              'Respond with valid JSON only, no markdown fences.',
          },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens:      2500,
        temperature:     0.45,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      return { success: false, error: `DeepSeek ${response.status}: ${t.slice(0, 200)}` };
    }

    const json = await response.json();
    const raw  = JSON.parse(json.choices[0].message.content) as DeepseekGeoPayload;
    parsed     = {
      overallVisibilityScore: clampScore(raw.overallVisibilityScore),
      sentimentAndCitations:  String(raw.sentimentAndCitations ?? ''),
      geoGapAnalysis:         String(raw.geoGapAnalysis ?? ''),
      globalActionPlan:       String(raw.globalActionPlan ?? ''),
      strategicHeadline:      String(raw.strategicHeadline ?? 'GEO strategy refresh'),
      strategicSummary:       String(raw.strategicSummary ?? ''),
      keywords:               Array.isArray(raw.keywords) ? raw.keywords : [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'DeepSeek parse error';
    console.error('[generateGeoReport]', msg);
    return { success: false, error: msg };
  }

  const generatedAt = new Date().toISOString();
  const strategyContent: GeoStrategyLogContent = {
    headline:                 parsed.strategicHeadline,
    summary:                  parsed.strategicSummary,
    overallVisibilityScore:   parsed.overallVisibilityScore,
    sentimentAndCitations:    parsed.sentimentAndCitations,
    geoGapAnalysis:           parsed.geoGapAnalysis,
    globalActionPlan:         parsed.globalActionPlan,
    generatedAt,
  };

  await supabase.from('geo_reports').delete().eq('tenant_id', tenantId).eq('metric_source', 'geo_ai');

  const { error: logErr } = await supabase.from('strategy_logs').insert({
    tenant_id:    tenantId,
    report_type:  'geo_strategy',
    content:      strategyContent,
    generated_at: generatedAt,
  });
  if (logErr) {
    console.error('[generateGeoReport] strategy_logs', logErr.message);
    return { success: false, error: logErr.message };
  }

  const gscByKey = new Map(top.map((t) => [t.keyword.toLowerCase(), t]));

  for (let i = 0; i < parsed.keywords.length; i++) {
    const k = parsed.keywords[i];
    const kw = String(k.keyword ?? top[i]?.keyword ?? `keyword_${i}`).slice(0, 500);
    const g = gscByKey.get(kw.toLowerCase()) ?? top[i];

    const { error: insErr } = await supabase.from('geo_reports').insert({
      tenant_id:     tenantId,
      keyword:       kw,
      engine:        'chatgpt',
      metric_source: 'geo_ai',
      rank_data:     {
        source:           'geo_ai_simulator',
        cited:            clampScore(k.visibilityScore) >= 60,
        position:         null,
        citationSource:   'deepseek-v3-simulation',
        snippet:          k.whyGeoLags ?? null,
        visibilityScore:  clampScore(k.visibilityScore),
        actionableSteps:  String(k.actionableSteps ?? ''),
        whyGeoLags:       k.whyGeoLags ? String(k.whyGeoLags) : null,
        gscImpressions:   g?.impressions ?? null,
        gscClicks:        g?.clicks ?? null,
        gscPosition:      g?.position ?? null,
      },
    });
    if (insErr) {
      console.error('[generateGeoReport] geo_reports insert', insErr.message);
    }
  }

  return { success: true };
}

export async function generateGeoReport(companyId: string, tenantName: string) {
  const validatedId = await requireTenantAction(companyId);
  await requirePermission('strategy.geo_run');
  const supabase    = await createSupabaseServerClient();
  return runGenerateGeoReportForTenant(validatedId, tenantName, supabase, { agencyContext: 'full' });
}
