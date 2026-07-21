import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const MAX_EVENTS = 25;

const inputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(180)
    .optional()
    .default(30)
    .describe('How many days ahead to look (default 30).'),
});

type Input = z.infer<typeof inputSchema>;

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Upcoming plan (social posts, calls, milestones) so scheduling suggestions are
 * grounded in what is already booked. Read-only and tenant-scoped.
 */
export const getCalendarTool: MonoAITool<typeof inputSchema> = {
  name: 'get_calendar',
  description:
    "Fetch this brand's upcoming calendar — scheduled social posts, calls and milestones. " +
    'Use before proposing publishing dates, spotting empty weeks, or summarising what is planned.',
  parameters: {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Days ahead to look (default 30, max 180).' },
    },
    required: [],
  },
  inputSchema,

  async execute(args: Input, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.safeParse(args);
    const days = parsed.success ? (parsed.data.days ?? 30) : 30;

    const today = new Date();
    const until = new Date(today);
    until.setDate(until.getDate() + days);

    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('title, event_type, event_date, event_time, platform, status, caption')
        .eq('tenant_id', context.tenantId)
        .gte('event_date', isoDate(today))
        .lte('event_date', isoDate(until))
        .order('event_date', { ascending: true })
        .limit(MAX_EVENTS);

      if (error) return { content: `Takvim alınamadı: ${error.message}`, isError: true };
      if (!data?.length) {
        return { content: `Önümüzdeki ${days} gün için planlanmış etkinlik yok — yayın takvimi boş.` };
      }

      const rows = data.map((e) => {
        const when = `${e.event_date}${e.event_time ? ` ${String(e.event_time).slice(0, 5)}` : ''}`;
        const bits = [`${when} — **${e.title}**`, `tür: ${e.event_type}`];
        if (e.platform) bits.push(`platform: ${e.platform}`);
        if (e.status) bits.push(`durum: ${e.status}`);
        return `- ${bits.join(' · ')}`;
      });

      return { content: `Önümüzdeki ${days} günün planı (${data.length} etkinlik):\n${rows.join('\n')}` };
    } catch (e) {
      return { content: `Takvim alınamadı: ${e instanceof Error ? e.message : String(e)}`, isError: true };
    }
  },
};
