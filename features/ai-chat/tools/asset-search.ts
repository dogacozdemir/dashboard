import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const MAX_PER_TYPE = 15;

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(200)
    .describe('Search query — matches against file names, titles, and captions'),
  asset_type: z
    .enum(['all', 'creative', 'brand'])
    .optional()
    .default('all')
    .describe('Filter by asset type: "creative" (ads/content), "brand" (logos/guidelines), or "all"'),
  status: z
    .enum(['all', 'pending', 'approved', 'revision'])
    .optional()
    .default('all')
    .describe('Filter creative assets by review status (ignored for brand assets)'),
});

type Input = z.infer<typeof inputSchema>;

export const assetSearchTool: MonoAITool<typeof inputSchema> = {
  name: 'search_assets',
  description:
    'Search the brand\'s uploaded assets — creative files (ads, social posts, videos) ' +
    'and brand assets (logos, brand books, guidelines). ' +
    'Use this when the user asks about files, creatives, brand materials, ' +
    'or wants to know what content is available in their workspace.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query — matches file names, titles, and captions',
      },
      asset_type: {
        type: 'string',
        enum:        ['all', 'creative', 'brand'],
        description: 'Asset type filter: "creative", "brand", or "all"',
      },
      status: {
        type: 'string',
        enum:        ['all', 'pending', 'approved', 'revision'],
        description: 'Filter creative assets by status (default: all)',
      },
    },
    required: ['query'],
  },
  inputSchema,

  async execute(args: Input, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        isError: true,
      };
    }

    const { query, asset_type = 'all', status = 'all' } = parsed.data;
    const supabase = await createSupabaseServerClient();
    const sections: string[] = [];
    let totalFound = 0;

    // Search creative assets
    if (asset_type === 'all' || asset_type === 'creative') {
      let creativeQuery = supabase
        .from('creative_assets')
        .select('id, title, url, status, platform, caption, created_at')
        .eq('tenant_id', context.tenantId)
        .or(`title.ilike.%${query}%,caption.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(MAX_PER_TYPE);

      if (status !== 'all') {
        creativeQuery = creativeQuery.eq('status', status);
      }

      const { data: creatives, error } = await creativeQuery;

      if (error) {
        console.error('[asset-search] creative error:', error.message);
      } else if (creatives && creatives.length > 0) {
        totalFound += creatives.length;
        const rows = creatives.map((a) => {
          const parts = [`**${a.title ?? 'Untitled'}**`];
          if (a.platform) parts.push(`Platform: ${a.platform}`);
          parts.push(`Status: ${a.status}`);
          if (a.caption) parts.push(`Caption: ${a.caption.slice(0, 80)}${a.caption.length > 80 ? '…' : ''}`);
          parts.push(`URL: ${a.url}`);
          return `- ${parts.join(' · ')}`;
        });
        sections.push(`**Creative Assets (${creatives.length} found):**\n${rows.join('\n')}`);
      }
    }

    // Search brand assets
    if (asset_type === 'all' || asset_type === 'brand') {
      const { data: brandAssets, error } = await supabase
        .from('brand_assets')
        .select('id, name, url, type, created_at')
        .eq('tenant_id', context.tenantId)
        .ilike('name', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(MAX_PER_TYPE);

      if (error) {
        console.error('[asset-search] brand error:', error.message);
      } else if (brandAssets && brandAssets.length > 0) {
        totalFound += brandAssets.length;
        const rows = brandAssets.map(
          (a) => `- **${a.name}** · Type: ${a.type} · ${a.url}`,
        );
        sections.push(`**Brand Assets (${brandAssets.length} found):**\n${rows.join('\n')}`);
      }
    }

    if (totalFound === 0) {
      return {
        content: `No assets found matching "${query}"${status !== 'all' ? ` with status "${status}"` : ''}.`,
      };
    }

    return {
      content: `**Asset search results for:** "${query}"\n\n${sections.join('\n\n')}`,
    };
  },
};
