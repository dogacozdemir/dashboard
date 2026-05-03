import type { AggregateMetrics } from '@/features/performance-hub/types';
import type { TimeRange } from '@/features/performance-hub/actions/fetchMetrics';
import type { CockpitPlatform } from '@/features/performance-hub/lib/cockpit-platform';

export async function generateMonoReportNarrative(input: {
  tenantName: string;
  range: TimeRange;
  cockpit: CockpitPlatform;
  metrics: AggregateMetrics;
  locale: 'tr' | 'en';
}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const { tenantName, range, cockpit, metrics, locale } = input;

  const kpi = {
    range,
    cockpit,
    spend: metrics.spend.current,
    revenue: metrics.revenue.current,
    roas: metrics.roas.current,
    hasData: metrics.hasData,
    period: metrics.dateRange,
  };

  if (!apiKey) {
    return locale === 'en'
      ? `Executive snapshot for ${tenantName} (${range} · ${cockpit}): ROAS ${kpi.roas.toFixed(2)}, spend ${kpi.spend.toFixed(0)}, revenue ${kpi.revenue.toFixed(0)}. ${kpi.hasData ? 'Figures reflect synced cockpit data for the selected window.' : 'Limited synced data in this window — connect accounts and run sync for fuller signal.'} Generated narrative uses static fallback when AI keys are not configured.`
      : `${tenantName} için yönetici özeti (${range} · ${cockpit}): ROAS ${kpi.roas.toFixed(2)}, harcama ${kpi.spend.toFixed(0)}, gelir ${kpi.revenue.toFixed(0)}. ${kpi.hasData ? 'Rakamlar seçilen penceredeki senkron cockpit verisini yansıtır.' : 'Bu pencerede sınırlı veri — tam sinyal için hesapları bağlayıp senkron çalıştırın.'} Yapılandırılmamış AI anahtarında statik özet kullanıldı.`;
  }

  const system =
    locale === 'en'
      ? 'You are monoAI, Madmonos strategic copilot. Write ONE tight executive paragraph (max 120 words) for a PDF "Strategic Summary". Be precise, no hype, acknowledge data is dashboard-synced. No markdown.'
      : 'Sen monoAI, Madmonos stratejik yardımcı pilotsun. PDF "Stratejik Özet" için TEK yoğun yönetici paragrafı (en fazla 900 karakter) yaz. Net ol, abartma, verinin dashboard senkronu olduğunu ima et. Markdown yok.';

  const user =
    locale === 'en'
      ? `Tenant: ${tenantName}. KPI JSON: ${JSON.stringify(kpi)}. Voice: premium, engineering-forward, frictionless.`
      : `Tenant: ${tenantName}. KPI JSON: ${JSON.stringify(kpi)}. Üslup: premium, mühendislik odaklı, frictionless.`;

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 400,
        temperature: 0.55,
      }),
    });
    if (!res.ok) return '';
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    return text || '';
  } catch {
    return '';
  }
}
