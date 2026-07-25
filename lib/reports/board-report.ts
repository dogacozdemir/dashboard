import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  fetchAggregateMetrics,
  fetchPlatformComparison,
  fetchGscSeoMatrix,
} from '@/features/performance-hub/actions/fetchMetrics';
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/utils/format';
import { deepseekChatModel, parseDeepseekJson } from '@/lib/ai/deepseek-model';

export interface BoardReportKpi {
  key: string;
  label: string;
  value: string;
  changePct: number | null;
  /** Whether a positive change is good (growth) or bad (cost). */
  positiveIsGood: boolean;
}

export interface BoardReport {
  tenantName: string;
  currency: string;
  period: { from: string; to: string };
  generatedAt: string;
  hasData: boolean;
  kpis: BoardReportKpi[];
  platforms: Array<{ platform: string; spend: number; revenue: number; roas: number; conversions: number }>;
  seo: {
    impressions: number;
    clicks: number;
    ctrPercent: number;
    avgPosition: number;
    nonBrandImpressions: number;
    connected: boolean;
  } | null;
  creative: { pending: number; approved: number; revision: number; total: number };
  narrative: {
    executiveSummary: string;
    performanceCommentary: string;
    seoCommentary: string;
    recommendations: string[];
  };
}

const nf = (n: number, d = 0) => n.toLocaleString('tr-TR', { maximumFractionDigits: d });
const pct = (v: { current: number; previous: number; change: number }) =>
  v.previous > 0 || v.current > 0 ? Math.round(v.change) : null;

async function generateBoardNarrative(
  tenantName: string,
  facts: Record<string, unknown>,
): Promise<BoardReport['narrative'] | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: deepseekChatModel(),
        messages: [
          {
            role: 'system',
            content:
              'Sen monoAI, Madmonos stratejik yardımcı pilotsun. Yönetim kurulu raporu için Türkçe, JSON only, markdown yok. Net, premium, abartısız.',
          },
          {
            role: 'user',
            content:
              `Marka: "${tenantName}". Dönem verisi (dashboard senkronu):\n${JSON.stringify(facts, null, 2)}\n\n` +
              `Şu JSON'u döndür: {"executiveSummary": string (3-4 cümle yönetici özeti), ` +
              `"performanceCommentary": string (2-4 cümle, ücretli medya yorumu), ` +
              `"seoCommentary": string (1-3 cümle, organik/SEO yorumu), ` +
              `"recommendations": string[] (tam 4 uygulanabilir öneri)}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1100,
        temperature: 0.5,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const p = parseDeepseekJson<Partial<BoardReport['narrative']>>(json?.choices?.[0]?.message?.content) ?? {};
    if (!p.executiveSummary) return null;
    return {
      executiveSummary: String(p.executiveSummary),
      performanceCommentary: String(p.performanceCommentary ?? ''),
      seoCommentary: String(p.seoCommentary ?? ''),
      recommendations: Array.isArray(p.recommendations) ? p.recommendations.map(String).slice(0, 4) : [],
    };
  } catch (e) {
    console.error('[board-report] narrative', e);
    return null;
  }
}

export async function buildBoardReport(
  companyId: string,
  tenantName: string,
  currency: string = DEFAULT_CURRENCY,
): Promise<BoardReport> {
  /** Money KPIs carry the tenant's own currency, not a bare number. */
  const cf = (n: number, d = 0) => formatCurrency(n, currency, d);
  const [metrics, comparison, gsc, creativeCounts] = await Promise.all([
    fetchAggregateMetrics(companyId, 'monthly', 'all'),
    fetchPlatformComparison(companyId, 'monthly', 'all'),
    fetchGscSeoMatrix(companyId, tenantName),
    (async () => {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.from('creative_posts').select('status').eq('tenant_id', companyId);
      const c = { pending: 0, approved: 0, revision: 0, total: 0 };
      for (const r of data ?? []) {
        c.total++;
        const s = r.status as string;
        if (s === 'pending') c.pending++;
        else if (s === 'approved') c.approved++;
        else if (s === 'revision') c.revision++;
      }
      return c;
    })(),
  ]);

  const kpis: BoardReportKpi[] = [
    { key: 'spend', label: 'Harcama', value: cf(metrics.spend.current), changePct: pct(metrics.spend), positiveIsGood: false },
    { key: 'revenue', label: 'Gelir', value: cf(metrics.revenue.current), changePct: pct(metrics.revenue), positiveIsGood: true },
    { key: 'roas', label: 'ROAS', value: `${metrics.roas.current.toFixed(2)}x`, changePct: pct(metrics.roas), positiveIsGood: true },
    { key: 'conversions', label: 'Dönüşüm', value: nf(metrics.conversions.current), changePct: pct(metrics.conversions), positiveIsGood: true },
    { key: 'ctr', label: 'CTR', value: `${metrics.ctr.current.toFixed(2)}%`, changePct: pct(metrics.ctr), positiveIsGood: true },
    { key: 'cpa', label: 'CPA', value: cf(metrics.cpa.current, 2), changePct: pct(metrics.cpa), positiveIsGood: false },
  ];

  const seo = gsc.hasGoogleConnection || gsc.impressions > 0
    ? {
        impressions: gsc.impressions,
        clicks: gsc.clicks,
        ctrPercent: gsc.ctrPercent,
        avgPosition: gsc.avgPosition,
        nonBrandImpressions: gsc.nonBrandImpressions,
        connected: gsc.hasGoogleConnection,
      }
    : null;

  const facts = {
    period: metrics.dateRange,
    spend: metrics.spend.current,
    revenue: metrics.revenue.current,
    roas: metrics.roas.current,
    conversions: metrics.conversions.current,
    ctr: metrics.ctr.current,
    spendChangePct: pct(metrics.spend),
    revenueChangePct: pct(metrics.revenue),
    roasChangePct: pct(metrics.roas),
    platforms: comparison,
    seo,
    creative: creativeCounts,
  };

  const ai = metrics.hasData ? await generateBoardNarrative(tenantName, facts) : null;

  const fallback: BoardReport['narrative'] = {
    executiveSummary: metrics.hasData
      ? `${tenantName} için bu dönem ROAS ${metrics.roas.current.toFixed(2)}x, toplam gelir ${cf(metrics.revenue.current)} ve harcama ${cf(metrics.spend.current)} olarak gerçekleşti. Kreatif hattında ${creativeCounts.approved} onaylı, ${creativeCounts.pending} incelemede içerik var.`
      : `${tenantName} için bu pencerede yeterli senkron veri yok. Reklam hesaplarını bağlayıp senkron çalıştırdıkça rapor zenginleşecek.`,
    performanceCommentary: metrics.hasData
      ? `Harcama ${pct(metrics.spend) ?? 0}% değişirken gelir ${pct(metrics.revenue) ?? 0}% seyretti; verimliliği en yüksek kanallara odaklanmak önerilir.`
      : '',
    seoCommentary: seo ? `Organik tarafta ${nf(seo.impressions)} gösterim ve ${nf(seo.clicks)} tıklama; marka dışı görünürlük talep sinyali taşıyor.` : '',
    recommendations: [
      'En yüksek ROAS getiren kampanyalarda bütçeyi kademeli artır.',
      'Düşük CTR gösteren kreatifleri yenile veya A/B test başlat.',
      'Bekleyen kreatif onaylarını hızlandırarak yayın temposunu koru.',
      'Marka dışı organik sorgular için açılış sayfası içeriğini güçlendir.',
    ],
  };

  return {
    tenantName,
    currency,
    period: metrics.dateRange,
    generatedAt: new Date().toISOString(),
    hasData: metrics.hasData,
    kpis,
    platforms: comparison,
    seo,
    creative: creativeCounts,
    narrative: ai ?? fallback,
  };
}
