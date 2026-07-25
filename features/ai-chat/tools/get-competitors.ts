import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const inputSchema = z.object({});

type Input = z.infer<typeof inputSchema>;

import { formatDetectedPrice, type DetectedPrice } from '@/lib/competitors/price';

type CompetitorRow = { id: string; name: string; url: string; last_checked_at: string | null };
type SnapshotRow = {
  competitor_id: string;
  changed: boolean;
  change_summary: string | null;
  fetched_at: string;
  prices: DetectedPrice[] | null;
};

/**
 * Lets MonoAI answer "what are my competitors doing?" from the tracked watch
 * list — the persistent counterpart to the ad-hoc crawl tools. Tenant-scoped;
 * reports only what has actually been recorded, never invents competitor moves.
 */
export const getCompetitorsTool: MonoAITool<typeof inputSchema> = {
  name: 'get_competitors',
  description:
    "Retrieve this brand's tracked competitors and any recent changes detected on their websites " +
    '(new products, campaigns, pricing, messaging). Use when the user asks about competitors, the ' +
    'competitive landscape, or what rivals are doing.',
  parameters: { type: 'object', properties: {}, required: [] },
  inputSchema,

  async execute(_args: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const supabase = await createSupabaseServerClient();

      const { data: comps } = await supabase
        .from('competitors')
        .select('id, name, url, last_checked_at')
        .eq('tenant_id', context.tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(20);

      const competitors = (comps ?? []) as CompetitorRow[];
      if (competitors.length === 0) {
        return {
          content:
            'Bu marka için henüz takip edilen rakip yok. Strateji sayfasındaki Rakip Takibi ' +
            'panelinden rakip eklendiğinde, sitelerindeki değişiklikleri buradan izleyebilirim.',
        };
      }

      const { data: snaps } = await supabase
        .from('competitor_snapshots')
        .select('competitor_id, changed, change_summary, fetched_at, prices')
        .eq('tenant_id', context.tenantId)
        .order('fetched_at', { ascending: false });

      const latest = new Map<string, SnapshotRow>();
      for (const s of (snaps ?? []) as SnapshotRow[]) {
        if (!latest.has(s.competitor_id)) latest.set(s.competitor_id, s);
      }

      const lines: string[] = [`Takip edilen rakipler (${competitors.length}):`, ''];
      for (const c of competitors) {
        const snap = latest.get(c.id);
        const host = (() => {
          try {
            return new URL(c.url).hostname.replace(/^www\./, '');
          } catch {
            return c.url;
          }
        })();

        lines.push(`- ${c.name} (${host})`);
        const prices = snap?.prices ?? [];
        if (prices.length > 0) {
          const priceLine = prices
            .map((pr) => (pr.label ? `${pr.label}: ${formatDetectedPrice(pr)}` : formatDetectedPrice(pr)))
            .join(', ');
          lines.push(`  · Tespit edilen fiyatlar: ${priceLine}`);
        }
        if (!snap) {
          lines.push('  · Henüz kontrol edilmedi.');
        } else if (snap.changed && snap.change_summary) {
          lines.push(`  · Son değişiklik: ${snap.change_summary.replace(/\n+/g, ' ')}`);
        } else if (snap.changed) {
          lines.push('  · Sayfası değişti (özet yok).');
        } else {
          lines.push('  · Son kontrolde önemli bir değişiklik yok.');
        }
      }

      return { content: lines.join('\n') };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: `Rakip verisi alınamadı: ${msg}`, isError: true };
    }
  },
};
