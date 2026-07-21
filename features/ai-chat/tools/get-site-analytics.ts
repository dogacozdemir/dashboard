import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const inputSchema = z.object({});

type Input = z.infer<typeof inputSchema>;

type DailyRow = {
  sessions: number | null;
  active_users: number | null;
  new_users: number | null;
  engaged_sessions: number | null;
  conversions: number | null;
  revenue: number | null;
};

type ChannelRow = {
  channel: string;
  sessions: number | null;
  conversions: number | null;
  revenue: number | null;
};

/**
 * Site-side truth from GA4 — the counterpart to `get_performance`, which only
 * knows what the ad platforms report. Tenant-scoped; never invents numbers.
 */
export const getSiteAnalyticsTool: MonoAITool<typeof inputSchema> = {
  name: 'get_site_analytics',
  description:
    "Retrieve this brand's Google Analytics 4 site behaviour for the last 30 days: sessions, users, " +
    'engagement rate, conversions, revenue, and the acquisition channel breakdown. Use when the user asks ' +
    'about site traffic, visitors, where traffic comes from, on-site conversions, or what happened after the click.',
  parameters: { type: 'object', properties: {}, required: [] },
  inputSchema,

  async execute(_args: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const supabase = await createSupabaseServerClient();

      const [{ data: prop }, { data: daily }, { data: channels }] = await Promise.all([
        supabase
          .from('ga4_properties')
          .select('display_name, synced_at')
          .eq('tenant_id', context.tenantId)
          .maybeSingle(),
        supabase
          .from('ga4_daily_metrics')
          .select('sessions, active_users, new_users, engaged_sessions, conversions, revenue')
          .eq('tenant_id', context.tenantId),
        supabase
          .from('ga4_channel_metrics')
          .select('channel, sessions, conversions, revenue')
          .eq('tenant_id', context.tenantId)
          .order('sessions', { ascending: false })
          .limit(8),
      ]);

      if (!prop) {
        return {
          content:
            'Bu marka için Google Analytics 4 bağlı değil. Site trafiği/davranış verisi yok — ' +
            'Google hesabı bağlandıktan sonra bu veri kullanılabilir olacak.',
        };
      }

      let sessions = 0, users = 0, newUsers = 0, engaged = 0, conversions = 0, revenue = 0;
      for (const r of (daily ?? []) as DailyRow[]) {
        sessions += Number(r.sessions ?? 0);
        users += Number(r.active_users ?? 0);
        newUsers += Number(r.new_users ?? 0);
        engaged += Number(r.engaged_sessions ?? 0);
        conversions += Number(r.conversions ?? 0);
        revenue += Number(r.revenue ?? 0);
      }

      if (sessions === 0) {
        return {
          content: 'GA4 mülkü bağlı ancak son 30 gün için henüz senkronize edilmiş oturum verisi yok.',
        };
      }

      const engagementPct = (engaged / sessions) * 100;
      const lines = [
        `Site analitiği (GA4${prop.display_name ? ` — ${prop.display_name}` : ''}), son 30 gün:`,
        `- Oturum: ${sessions.toLocaleString('tr-TR')} · Aktif kullanıcı: ${users.toLocaleString('tr-TR')} · Yeni kullanıcı: ${newUsers.toLocaleString('tr-TR')}`,
        `- Etkileşim oranı: ${engagementPct.toFixed(1)}%`,
        `- Dönüşüm: ${conversions.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} · Gelir: ${revenue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} (hesabın para biriminde)`,
      ];

      const chRows = (channels ?? []) as ChannelRow[];
      if (chRows.length) {
        lines.push('', 'Kanal kırılımı (oturuma göre):');
        for (const c of chRows) {
          const s = Number(c.sessions ?? 0);
          const share = sessions > 0 ? (s / sessions) * 100 : 0;
          lines.push(
            `- ${c.channel}: ${s.toLocaleString('tr-TR')} oturum (%${share.toFixed(1)}), ` +
              `${Number(c.conversions ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} dönüşüm, ` +
              `gelir ${Number(c.revenue ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
          );
        }
      }

      return { content: lines.join('\n') };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: `Site analitiği alınamadı: ${msg}`, isError: true };
    }
  },
};
