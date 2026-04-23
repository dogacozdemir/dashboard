'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import type { GeoReport, RoadmapItem, MarketInsight } from '../types';

export async function fetchGeoReports(companyId: string): Promise<GeoReport[]> {
  const validatedId = await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('geo_reports')
    .select('id, keyword, engine, rank_data, created_at')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[fetchGeoReports]', error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((r) => ({
    id:        r.id,
    keyword:   r.keyword,
    engine:    r.engine as GeoReport['engine'],
    rankData:  r.rank_data as GeoReport['rankData'],
    createdAt: r.created_at,
  }));
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

  const supabase = await createSupabaseServerClient();

  // Return cached insight if generated within last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await supabase
    .from('strategy_logs')
    .select('content, generated_at')
    .eq('tenant_id', validatedId)
    .eq('report_type', 'market_insight')
    .gte('generated_at', oneDayAgo)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (cached?.content) {
    return cached.content as MarketInsight;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You are a senior digital marketing strategist specializing in AI-first marketing and GEO (Generative Engine Optimization). ' +
              'Provide concise, actionable insights in JSON format only.',
          },
          {
            role: 'user',
            content:
              `Generate a market insight report for "${tenantName}", a brand managed by Madmonos AI-first marketing agency. ` +
              'Return a JSON object with exactly these fields: ' +
              '{ "summary": string (2-3 sentences of strategic overview), ' +
              '"opportunities": string[] (3 actionable opportunities), ' +
              '"threats": string[] (2 key threats to watch), ' +
              '"geoRecommendation": string (specific GEO/AI-citation strategy), ' +
              '"confidence": number (0-100) }',
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('[fetchMarketInsight] DeepSeek API error:', response.status);
      return null;
    }

    const json = await response.json();
    const content = JSON.parse(json.choices[0].message.content) as MarketInsight;

    // Cache result
    await supabase.from('strategy_logs').insert({
      tenant_id:    validatedId,
      report_type:  'market_insight',
      content,
      generated_at: new Date().toISOString(),
    });

    return content;
  } catch (err) {
    console.error('[fetchMarketInsight]', err);
    return null;
  }
}
