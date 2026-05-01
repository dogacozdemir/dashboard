'use server';

import { auth } from '@/lib/auth/config';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { requirePermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import type { SessionUser } from '@/types/user';
import { runSyncAdPlatformForTenant } from '@/features/oauth/actions/syncPlatformData';
import type { AdPlatform } from '@/features/oauth/types';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

const ALLOWED_HREFS = new Set([
  '/dashboard',
  '/performance',
  '/creative',
  '/strategy',
  '/brand-vault',
  '/chat',
  '/mono-ai',
  '/calendar',
  '/settings/team',
  '/profile',
]);

const SPOTLIGHT_METRICS = new Set([
  'spend',
  'revenue',
  'roas',
  'cpa',
  'clicks',
  'ctr',
  'impressions',
  'conversionRate',
]);

export type CommandDataRow =
  | { source: 'campaign'; id: string; title: string; subtitle: string; href: string }
  | { source: 'creative'; id: string; title: string; subtitle: string; href: string }
  | { source: 'keyword'; id: string; title: string; subtitle: string; href: string };

function sanitizeIlike(q: string): string {
  return q.replace(/[%_]/g, '').trim();
}

export async function searchCommandData(companyId: string, query: string): Promise<CommandDataRow[]> {
  const cid = await requireTenantAction(companyId);
  const raw = sanitizeIlike(query);
  if (raw.length < 2) return [];

  const pattern = `%${raw}%`;
  const supabase = await createSupabaseServerClient();

  const [camp, crea, geo] = await Promise.all([
    supabase
      .from('ad_campaigns')
      .select('id, campaign_name, platform')
      .eq('tenant_id', cid)
      .ilike('campaign_name', pattern)
      .limit(6),
    supabase
      .from('creative_assets')
      .select('id, title, status')
      .eq('tenant_id', cid)
      .ilike('title', pattern)
      .limit(6),
    supabase
      .from('geo_reports')
      .select('id, keyword, metric_source')
      .eq('tenant_id', cid)
      .ilike('keyword', pattern)
      .limit(6),
  ]);

  const out: CommandDataRow[] = [];
  for (const r of camp.data ?? []) {
    out.push({
      source: 'campaign',
      id: r.id,
      title: r.campaign_name,
      subtitle: `Veri · Kampanya · ${r.platform}`,
      href: '/performance',
    });
  }
  for (const r of crea.data ?? []) {
    out.push({
      source: 'creative',
      id: r.id,
      title: r.title,
      subtitle: `Veri · Kreatif · ${r.status}`,
      href: '/creative',
    });
  }
  for (const r of geo.data ?? []) {
    out.push({
      source: 'keyword',
      id: r.id,
      title: r.keyword,
      subtitle: `Veri · SEO/GEO · ${r.metric_source ?? 'rapor'}`,
      href: '/strategy',
    });
  }
  return out;
}

function filterHrefForUser(user: SessionUser | undefined, href: string): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (href === '/settings/team') return sessionHasPermission(user, 'management.users');
  return true;
}

function looksLikeQuestion(q: string): boolean {
  const t = q.trim();
  if (t.length < 6 && !/\?/.test(t)) return false;
  return (
    /\?/.test(t) ||
    /^(what|how|why|where|ne |nasıl|neden|durum|göster|aç |izle|check)/i.test(t) ||
    t.length > 36
  );
}

function interpretLocalIntent(lower: string): { href: string; spotlight: string | null; label: string } | null {
  if (/roas|return on ad|reklam getirisi/.test(lower))
    return { href: '/performance', spotlight: 'roas', label: 'ROAS özeti' };
  if (/harcama|spend|bütçe|butce/.test(lower))
    return { href: '/performance', spotlight: 'spend', label: 'Harcama' };
  if (/gelir|revenue|ciro/.test(lower))
    return { href: '/performance', spotlight: 'revenue', label: 'Gelir' };
  if (/cpa|edinsel maliyet|conversion cost/.test(lower))
    return { href: '/performance', spotlight: 'cpa', label: 'CPA' };
  if (/ctr|tıklama oranı|tiklanma orani/.test(lower))
    return { href: '/performance', spotlight: 'ctr', label: 'CTR' };
  if (/gösterim|gosterim|impression|impressions/.test(lower))
    return { href: '/performance', spotlight: 'impressions', label: 'Gösterim' };
  if (/\bclicks\b|tıklama|tiklama(?! oran)/.test(lower))
    return { href: '/performance', spotlight: 'clicks', label: 'Tıklama' };
  if (/dönüşüm oranı|donusum orani|conversion rate/.test(lower))
    return { href: '/performance', spotlight: 'conversionRate', label: 'Dönüşüm oranı' };
  if (/seo|geo|anahtar kelime|keyword|arama|gsc/.test(lower))
    return { href: '/strategy', spotlight: null, label: 'SEO & GEO' };
  if (/kreatif|creative|asset|varlık|varlik/.test(lower))
    return { href: '/creative', spotlight: null, label: 'Kreatif Stüdyo' };
  if (/ekip|takım|takim|kullanıcı|kullanici|davet|team|user yönet/.test(lower))
    return { href: '/settings/team', spotlight: null, label: 'Ekip yönetimi' };
  if (/marka|brand vault|vault/.test(lower)) return { href: '/brand-vault', spotlight: null, label: 'Brand Vault' };
  if (/takvim|calendar|ops/.test(lower)) return { href: '/calendar', spotlight: null, label: 'Takvim' };
  if (/mono|ai sohbet|assistant/.test(lower)) return { href: '/mono-ai', spotlight: null, label: 'Mono AI' };
  if (/sohbet|chat|mesaj/.test(lower)) return { href: '/chat', spotlight: null, label: 'Chat' };
  if (/profil|profile|hesap ayar/.test(lower)) return { href: '/profile', spotlight: null, label: 'Profil' };
  return null;
}

export async function interpretNaturalLanguageCommand(
  companyId: string,
  query: string
): Promise<{ href: string; spotlight: string | null; label: string } | null> {
  await requireTenantAction(companyId);
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const q = query.trim();
  if (q.length < 3) return null;

  const lower = q.toLowerCase();
  const local = interpretLocalIntent(lower);
  if (local && filterHrefForUser(user, local.href)) return local;

  if (!looksLikeQuestion(q)) return null;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.3,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              'Madmonos dashboard intent router. User asks in Turkish or English. Reply ONLY JSON: {"href":"/path","spotlight":null or one of spend,revenue,roas,cpa,clicks,ctr,impressions,conversionRate,"label":"short Turkish label"}\n' +
              'Allowed href: /dashboard /performance /creative /strategy /brand-vault /chat /mono-ai /calendar /settings/team /profile\n' +
              'ROAS/revenue/spend/CPA/CTR/clicks/impressions/conversion -> /performance + spotlight. SEO/keywords/GEO -> /strategy. Creative -> /creative. Team/users/invite -> /settings/team. Brand -> /brand-vault. Calendar -> /calendar. Mono AI -> /mono-ai. Chat -> /chat. Home -> /dashboard.\n' +
              'If unclear: /dashboard spotlight null.',
          },
          { role: 'user', content: q },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
      href?: string;
      spotlight?: string | null;
      label?: string;
    };
    if (!parsed.href || !ALLOWED_HREFS.has(parsed.href)) return null;
    if (!filterHrefForUser(user, parsed.href)) return null;
    let spotlight: string | null = null;
    if (parsed.spotlight && SPOTLIGHT_METRICS.has(parsed.spotlight)) spotlight = parsed.spotlight;
    return {
      href: parsed.href,
      spotlight,
      label: typeof parsed.label === 'string' ? parsed.label : 'Önerilen',
    };
  } catch {
    return null;
  }
}

export async function syncAllConnectedPlatformsAction(
  companyId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireTenantAction(companyId);
  await requirePermission('integrations.manage');
  const supabase = await createSupabaseServerClient();
  const { data: rows, error: qErr } = await supabase
    .from('ad_accounts')
    .select('platform')
    .eq('tenant_id', companyId)
    .eq('is_active', true);

  if (qErr) return { ok: false, error: qErr.message };

  const platforms = [...new Set((rows ?? []).map((r) => r.platform as AdPlatform))];
  if (!platforms.length) return { ok: false, error: 'Aktif reklam hesabı yok.' };

  for (const p of platforms) {
    const r = await runSyncAdPlatformForTenant(companyId, p, supabase);
    if (!r.success) console.warn('[syncAllConnected]', p, r.error);
  }

  return { ok: true };
}
