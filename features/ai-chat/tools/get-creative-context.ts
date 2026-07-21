import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const MAX_POSTS = 5;

const inputSchema = z.object({
  title: z
    .string()
    .max(200)
    .optional()
    .describe('Optional title/caption fragment to narrow to a specific creative.'),
  status: z
    .enum(['all', 'pending', 'approved', 'revision'])
    .optional()
    .default('all')
    .describe('Filter by review status (default: all).'),
});

type Input = z.infer<typeof inputSchema>;

/**
 * Grounds the assistant in the real creative workflow: post details plus the
 * existing revision thread, so drafted revision notes reference actual content
 * instead of being invented. Read-only and tenant-scoped.
 */
export const getCreativeContextTool: MonoAITool<typeof inputSchema> = {
  name: 'get_creative_context',
  description:
    "Fetch this brand's creatives with their full review context — caption, format, schedule, status " +
    'and the existing revision notes. Use before drafting revision feedback, summarising what is ' +
    'waiting for approval, or answering questions about specific content.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Optional title/caption fragment to narrow the search.' },
      status: {
        type: 'string',
        enum: ['all', 'pending', 'approved', 'revision'],
        description: 'Filter by review status (default all).',
      },
    },
    required: [],
  },
  inputSchema,

  async execute(args: Input, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.safeParse(args);
    const title = parsed.success ? parsed.data.title : undefined;
    const status = parsed.success ? (parsed.data.status ?? 'all') : 'all';

    try {
      const supabase = await createSupabaseServerClient();

      let q = supabase
        .from('creative_posts')
        .select('id, title, caption, platform, content_format, status, scheduled_date, scheduled_time, created_at')
        .eq('tenant_id', context.tenantId)
        .order('created_at', { ascending: false })
        .limit(MAX_POSTS);

      if (status !== 'all') q = q.eq('status', status);
      if (title?.trim()) q = q.or(`title.ilike.%${title.trim()}%,caption.ilike.%${title.trim()}%`);

      const { data: posts, error } = await q;
      if (error) return { content: `Kreatif bağlamı alınamadı: ${error.message}`, isError: true };
      if (!posts?.length) {
        return { content: 'Bu filtreye uyan kreatif bulunamadı.' };
      }

      const postIds = posts.map((p) => p.id as string);

      // Map post -> asset ids -> revision comments (revisions reference creative_assets).
      const { data: assets } = await supabase
        .from('creative_assets')
        .select('id, post_id')
        .in('post_id', postIds)
        .eq('tenant_id', context.tenantId);

      const assetToPost = new Map<string, string>();
      for (const a of assets ?? []) assetToPost.set(a.id as string, a.post_id as string);

      const revisionsByPost = new Map<string, string[]>();
      if (assetToPost.size > 0) {
        const { data: revs } = await supabase
          .from('revisions')
          .select('asset_id, comment, created_at, resolved_at')
          .in('asset_id', [...assetToPost.keys()])
          .eq('tenant_id', context.tenantId)
          .order('created_at', { ascending: false })
          .limit(30);
        for (const r of revs ?? []) {
          const postId = assetToPost.get(r.asset_id as string);
          if (!postId) continue;
          const text = String(r.comment ?? '').trim();
          if (!text) continue;
          const mark = r.resolved_at ? '(çözüldü) ' : '';
          const list = revisionsByPost.get(postId) ?? [];
          if (list.length < 4) list.push(`${mark}${text.slice(0, 200)}`);
          revisionsByPost.set(postId, list);
        }
      }

      const blocks = posts.map((p) => {
        const lines = [
          `**${p.title ?? 'Başlıksız'}** — durum: ${p.status}`,
          `- Format: ${p.content_format ?? 'feed_post'}${p.platform ? ` · Platform: ${p.platform}` : ''}`,
        ];
        if (p.scheduled_date) {
          lines.push(`- Plan: ${p.scheduled_date}${p.scheduled_time ? ` ${String(p.scheduled_time).slice(0, 5)}` : ''}`);
        }
        if (p.caption) {
          const c = String(p.caption);
          lines.push(`- Açıklama: ${c.slice(0, 240)}${c.length > 240 ? '…' : ''}`);
        }
        const revs = revisionsByPost.get(p.id as string) ?? [];
        lines.push(
          revs.length
            ? `- Mevcut revizyon notları:\n${revs.map((r) => `   • ${r}`).join('\n')}`
            : '- Mevcut revizyon notu yok.',
        );
        return lines.join('\n');
      });

      return { content: `Kreatif bağlamı (${posts.length} içerik):\n\n${blocks.join('\n\n')}` };
    } catch (e) {
      return { content: `Kreatif bağlamı alınamadı: ${e instanceof Error ? e.message : String(e)}`, isError: true };
    }
  },
};
