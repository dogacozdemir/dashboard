'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { fetchAggregateMetrics } from '@/features/performance-hub/actions/fetchMetrics';
import { tenantDashboardMetricsTag } from '@/lib/cache/dashboard-tags';
import type { DashboardGoal } from '@/types/tenant';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

const FALLBACK_HINTS_TR = [
  'İlk 14 günde en yüksek harcamalı kampanyada teklif üst sınırını kontrol edin; bütçe kısıtı görünürlüğü düşürüyor olabilir.',
  'Arama ve feed kanallarını ayırarak raporlayın; karışık veri ROAS yorumunu yumuşatır.',
  'Dönüşüm penceresini (attribution window) iş modelinize göre netleştirin; erken kesilen veri optimizasyonu bozar.',
];

export async function checkMagicSyncReady(companyId: string): Promise<boolean> {
  const cid = await requireTenantAction(companyId);
  const agg = await fetchAggregateMetrics(cid, 'monthly');
  return agg.hasData;
}

async function buildOnboardingDataSnapshot(tenantId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const agg = await fetchAggregateMetrics(tenantId, 'monthly');

  const lines: string[] = [];
  lines.push(`Reklam özeti (aylık): veri var mı: ${agg.hasData}`);
  if (agg.hasData) {
    lines.push(
      `Harcama: ${agg.spend.current.toFixed(0)}, Gelir: ${agg.revenue.current.toFixed(0)}, ROAS: ${agg.roas.current.toFixed(2)}, CTR: ${agg.ctr.current.toFixed(2)}%, Tıklama: ${agg.clicks.current.toFixed(0)}, Gösterim: ${agg.impressions.current.toFixed(0)}, CPA: ${agg.cpa.current.toFixed(2)}`
    );
  }

  const { data: pages } = await supabase
    .from('gsc_page_analytics')
    .select('page_url, clicks, impressions, ctr, position')
    .eq('tenant_id', tenantId)
    .order('clicks', { ascending: false })
    .limit(5);

  if (pages?.length) {
    lines.push('GSC üst sayfalar (tıklama):');
    for (const p of pages) {
      lines.push(
        `- ${String(p.page_url).slice(0, 80)} · tık ${p.clicks} · gösterim ${p.impressions} · CTR ${Number(p.ctr).toFixed(2)}% · pos ${Number(p.position).toFixed(1)}`
      );
    }
  } else {
    lines.push('GSC sayfa verisi henüz yok veya senkron bekleniyor.');
  }

  const { count: campaignCount } = await supabase
    .from('ad_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  lines.push(`Kampanya kayıt sayısı: ${campaignCount ?? 0}`);

  return lines.join('\n');
}

export async function runMagicQuickWins(companyId: string): Promise<{ hints: string[] }> {
  const cid = await requireTenantAction(companyId);
  const snapshot = await buildOnboardingDataSnapshot(cid);
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return { hints: FALLBACK_HINTS_TR };
  }

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.45,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content:
              'Sen MonoAI: Madmonos ajans sesi — premium, frictionless, mühendislik odaklı. SADECE geçerli JSON döndür: {"hints":["...","...","..."]} — tam 3 ipucu, Türkçe, her biri en fazla 22 kelime, somut ve uygulanabilir "hızlı kazanç". Veri zayıfsa yine de genel ama dürüst ipuçları ver. Markdown yok.',
          },
          {
            role: 'user',
            content: `Aşağıdaki gerçek panel özeti için 3 hızlı kazanç öner:\n\n${snapshot}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { hints: FALLBACK_HINTS_TR };
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) return { hints: FALLBACK_HINTS_TR };

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as { hints?: unknown };
    const hints = Array.isArray(parsed.hints)
      ? parsed.hints.filter((h): h is string => typeof h === 'string' && h.trim().length > 0).slice(0, 3)
      : [];

    if (hints.length < 3) {
      return { hints: [...hints, ...FALLBACK_HINTS_TR].slice(0, 3) };
    }
    return { hints };
  } catch {
    return { hints: FALLBACK_HINTS_TR };
  }
}

export async function completeMagicOnboarding(
  companyId: string,
  goal: DashboardGoal
): Promise<{ success: boolean; error?: string }> {
  const cid = await requireTenantAction(companyId);
  if (!['sales', 'awareness', 'cost'].includes(goal)) {
    return { success: false, error: 'Geçersiz hedef.' };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { success: false, error: 'Yapılandırma eksik.' };
  }

  const { error } = await admin
    .from('tenants')
    .update({
      dashboard_goal: goal,
      magic_onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', cid);

  if (error) {
    console.error('[completeMagicOnboarding]', error.message);
    return { success: false, error: 'Kaydedilemedi.' };
  }

  revalidatePath('/dashboard', 'page');
  revalidatePath('/performance', 'page');
  revalidateTag(tenantDashboardMetricsTag(cid), 'max');

  return { success: true };
}
