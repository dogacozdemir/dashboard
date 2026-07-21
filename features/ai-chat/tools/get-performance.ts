import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const inputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .default(30)
    .describe('Look-back window in days (default 30).'),
});

type Input = z.infer<typeof inputSchema>;

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Gives the assistant on-demand access to the tenant's own paid-media performance.
 * Tenant-scoped: reads only `context.tenantId` (RLS enforces the same on the RPC).
 */
export const getPerformanceTool: MonoAITool<typeof inputSchema> = {
  name: 'get_performance',
  description:
    "Retrieve this brand's advertising performance (spend, revenue, ROAS, CTR, conversions) " +
    'aggregated over a look-back window, with a per-platform breakdown. Use whenever the user asks ' +
    'about results, spend, ROAS, campaigns, or trends.',
  parameters: {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Look-back window in days (default 30, max 365).' },
    },
    required: [],
  },
  inputSchema,

  async execute(args: Input, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.safeParse(args);
    const days = parsed.success ? parsed.data.days : 30;

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - (days - 1));

    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc('aggregate_daily_metrics_range', {
        p_tenant_id: context.tenantId,
        p_from: isoDate(from),
        p_to: isoDate(now),
      });
      if (error) {
        return { content: `Performans verisi alınamadı: ${error.message}`, isError: true };
      }

      const rows = (data as Array<Record<string, unknown>>) ?? [];
      let spend = 0, revenue = 0, impressions = 0, clicks = 0, conversions = 0, organicImpr = 0, organicClicks = 0;
      const perPlatform: string[] = [];

      for (const r of rows) {
        const platform = String(r.platform);
        const s = Number(r.spend);
        const rev = Number(r.revenue);
        const im = Number(r.impressions);
        const cl = Number(r.clicks);
        const cv = Number(r.conversions);
        if (platform === 'organic') {
          organicImpr += im;
          organicClicks += cl;
          continue;
        }
        spend += s; revenue += rev; impressions += im; clicks += cl; conversions += cv;
        const pRoas = s > 0 ? rev / s : 0;
        const pCtr = im > 0 ? (cl / im) * 100 : 0;
        perPlatform.push(
          `- ${platform}: harcama ${s.toFixed(0)}, gelir ${rev.toFixed(0)}, ROAS ${pRoas.toFixed(2)}x, CTR ${pCtr.toFixed(2)}%, dönüşüm ${cv}`,
        );
      }

      if (spend === 0 && impressions === 0 && organicImpr === 0) {
        return {
          content: `Son ${days} günde ölçülmüş performans verisi yok (bağlı reklam hesabı veya senkron gerekli).`,
        };
      }

      const roas = spend > 0 ? revenue / spend : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      const lines = [
        `Ücretli medya performansı — son ${days} gün (para birimi hesap ayarına bağlı):`,
        `- Toplam harcama: ${spend.toFixed(0)}`,
        `- Toplam gelir (spend×ROAS): ${revenue.toFixed(0)}`,
        `- Blended ROAS: ${roas.toFixed(2)}x`,
        `- Gösterim: ${impressions.toLocaleString()} · Tıklama: ${clicks.toLocaleString()} · CTR: ${ctr.toFixed(2)}%`,
        `- Dönüşüm: ${conversions.toLocaleString()} · CPA: ${cpa.toFixed(2)}`,
      ];
      if (organicImpr > 0) lines.push(`- Organik (GSC): ${organicImpr.toLocaleString()} gösterim · ${organicClicks.toLocaleString()} tıklama`);
      if (perPlatform.length) lines.push('', 'Platform kırılımı:', ...perPlatform);

      return { content: lines.join('\n') };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: `Performans verisi alınamadı: ${msg}`, isError: true };
    }
  },
};
