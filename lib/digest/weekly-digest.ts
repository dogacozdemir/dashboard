import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Weekly digest: proactive performance narrative + recommended actions per tenant.
 * Pure computation + optional AI narrative (DeepSeek). Delivery (email / in-app)
 * is handled by the caller (cron route).
 */

export interface DigestWindow {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
}

export interface TenantDigest {
  tenantId: string;
  tenantName: string;
  current: DigestWindow;
  previous: DigestWindow;
  spendChangePct: number;
  revenueChangePct: number;
  roasChangePct: number;
  /** AI (or templated) narrative + recommended actions. */
  narrative: string;
  actions: string[];
  /** False when there is no paid activity in either window — caller should skip. */
  hasData: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function changePct(cur: number, prev: number): number {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
  return cur > 0 ? 100 : 0;
}

async function windowTotals(
  admin: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
): Promise<DigestWindow> {
  const { data } = await admin.rpc('aggregate_daily_metrics_range', {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
  });

  const w: DigestWindow = { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 };
  for (const raw of (data as Array<Record<string, unknown>>) ?? []) {
    if (String(raw.platform) === 'organic') continue;
    w.spend += Number(raw.spend);
    w.revenue += Number(raw.revenue);
    w.impressions += Number(raw.impressions);
    w.clicks += Number(raw.clicks);
    w.conversions += Number(raw.conversions);
  }
  w.roas = w.spend > 0 ? w.revenue / w.spend : 0;
  return w;
}

async function aiNarrative(
  tenantName: string,
  cur: DigestWindow,
  spendChangePct: number,
  revenueChangePct: number,
  roasChangePct: number,
): Promise<{ narrative: string; actions: string[] } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const facts = {
    spend: Math.round(cur.spend),
    revenue: Math.round(cur.revenue),
    roas: Math.round(cur.roas * 100) / 100,
    conversions: cur.conversions,
    spendChangePct,
    revenueChangePct,
    roasChangePct,
  };

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You are Madmonos, a performance-marketing strategist. Reply in Turkish, JSON only, no markdown.',
          },
          {
            role: 'user',
            content:
              `Marka: "${tenantName}". Son 7 günün ücretli medya özeti (önceki 7 güne göre değişim %):\n` +
              `${JSON.stringify(facts, null, 2)}\n\n` +
              `Şu JSON'u döndür: { "narrative": string (2-3 cümle, yöneticiye hitaben, sayıları yorumla), ` +
              `"actions": string[] (tam 3 madde, uygulanabilir öneri) }`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 700,
        temperature: 0.5,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json.choices[0].message.content) as { narrative?: string; actions?: string[] };
    const actions = Array.isArray(parsed.actions) ? parsed.actions.map(String).slice(0, 3) : [];
    if (!parsed.narrative) return null;
    return { narrative: String(parsed.narrative), actions };
  } catch (e) {
    console.error('[weekly-digest] AI narrative', e);
    return null;
  }
}

function templatedNarrative(
  cur: DigestWindow,
  spendChangePct: number,
  revenueChangePct: number,
  roasChangePct: number,
): { narrative: string; actions: string[] } {
  const dir = (p: number) => (p > 0 ? `%${p} arttı` : p < 0 ? `%${Math.abs(p)} azaldı` : 'sabit kaldı');
  return {
    narrative:
      `Bu hafta harcama ${dir(spendChangePct)}, gelir ${dir(revenueChangePct)} ve ROAS ${dir(roasChangePct)}. ` +
      `Toplam ${cur.conversions.toLocaleString()} dönüşüm elde edildi.`,
    actions: [
      roasChangePct < 0 ? 'ROAS düşen kanallarda bütçeyi en verimli kampanyalara kaydır.' : 'En yüksek ROAS getiren kampanyalarda bütçeyi kademeli artır.',
      'Düşük CTR gösteren kreatifleri yenile veya A/B test başlat.',
      'Dönüşüm oranı zayıf açılış sayfalarını gözden geçir.',
    ],
  };
}

export async function buildTenantDigest(
  admin: SupabaseClient,
  tenantId: string,
  tenantName: string,
): Promise<TenantDigest> {
  const now = new Date();
  const curTo = isoDate(now);
  const curFromD = new Date(now); curFromD.setDate(curFromD.getDate() - 6);
  const curFrom = isoDate(curFromD);
  const prevToD = new Date(curFromD); prevToD.setDate(prevToD.getDate() - 1);
  const prevTo = isoDate(prevToD);
  const prevFromD = new Date(prevToD); prevFromD.setDate(prevFromD.getDate() - 6);
  const prevFrom = isoDate(prevFromD);

  const [current, previous] = await Promise.all([
    windowTotals(admin, tenantId, curFrom, curTo),
    windowTotals(admin, tenantId, prevFrom, prevTo),
  ]);

  const spendChangePct = changePct(current.spend, previous.spend);
  const revenueChangePct = changePct(current.revenue, previous.revenue);
  const roasChangePct = changePct(current.roas, previous.roas);
  const hasData = current.spend > 0 || previous.spend > 0;

  const ai = hasData ? await aiNarrative(tenantName, current, spendChangePct, revenueChangePct, roasChangePct) : null;
  const fallback = templatedNarrative(current, spendChangePct, revenueChangePct, roasChangePct);

  return {
    tenantId,
    tenantName,
    current,
    previous,
    spendChangePct,
    revenueChangePct,
    roasChangePct,
    narrative: ai?.narrative ?? fallback.narrative,
    actions: ai?.actions?.length ? ai.actions : fallback.actions,
    hasData,
  };
}
