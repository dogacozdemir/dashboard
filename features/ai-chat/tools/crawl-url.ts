import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { chunkText } from '@/features/brand-vault/lib/chunkText';
import { embedTexts, embeddingToPgLiteral, isEmbeddingsConfigured } from '@/features/ai-chat/lib/embeddings';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const MAX_CONTENT_CHARS = 12_000;
const FETCH_TIMEOUT_MS  = 14_000;
const EMBED_BATCH       = 16;

const inputSchema = z.object({
  url: z.string().url().describe('Full URL to crawl (http or https)'),
  persist: z
    .boolean()
    .optional()
    .default(true)
    .describe('Store chunks in external_knowledge_chunks for DeepMarka RAG'),
});

type Input = z.infer<typeof inputSchema>;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const crawlUrlTool: MonoAITool<typeof inputSchema> = {
  name: 'crawl_url',
  description:
    'Fetch a specific public URL, extract readable text, optionally vectorize and store for tenant intelligence. ' +
    'Use for competitor pages, client landing pages, or any explicit link the user provides.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL to crawl' },
      persist: { type: 'boolean', description: 'Save embeddings to external_knowledge_chunks (default true)' },
    },
    required: ['url'],
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

    const { url, persist } = parsed.data;
    const domain = hostnameFromUrl(url);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'DeepMarka/1.0 (+https://madmonos.com; MonoAI crawl)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'follow',
      });
    } catch (err) {
      return {
        content: `Crawl failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }

    if (!response.ok) {
      return {
        content: `HTTP ${response.status} — could not crawl ${url}`,
        isError: true,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text') && !contentType.includes('html')) {
      return {
        content: `Non-text content type (${contentType}) — only HTML/text pages are supported.`,
        isError: true,
      };
    }

    const raw = await response.text();
    const text = stripHtmlToText(raw).slice(0, MAX_CONTENT_CHARS);
    if (text.length < 40) {
      return { content: `Crawl returned insufficient text from ${url}.`, isError: true };
    }

    const preview = text.slice(0, 2400);
    let persistNote = '';

    if (persist && isEmbeddingsConfigured()) {
      try {
        const supabase = await createSupabaseServerClient();
        const chunks = chunkText(text);
        if (chunks.length > 0) {
          await supabase
            .from('external_knowledge_chunks')
            .delete()
            .eq('tenant_id', context.tenantId)
            .eq('source_url', url);

          for (let offset = 0; offset < chunks.length; offset += EMBED_BATCH) {
            const batch = chunks.slice(offset, offset + EMBED_BATCH);
            const vectors = await embedTexts(batch);
            const rows = batch.map((content, j) => ({
              tenant_id: context.tenantId,
              source_url: url,
              source_domain: domain,
              chunk_index: offset + j,
              content,
              embedding: embeddingToPgLiteral(vectors[j]),
            }));
            const { error } = await supabase.from('external_knowledge_chunks').insert(rows);
            if (error) throw new Error(error.message);
          }
          persistNote = `\n\n[Stored ${chunks.length} vector chunk(s) for DeepMarka intelligence.]`;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[crawl_url] persist', msg);
        persistNote = `\n\n[Vector persistence skipped: ${msg}]`;
      }
    } else if (persist && !isEmbeddingsConfigured()) {
      persistNote = '\n\n[Embeddings unavailable — crawl text returned but not vectorized.]';
    }

    return {
      content:
        `**Crawled:** ${url}\n` +
        `**Domain:** ${domain}\n\n` +
        `---\n${preview}${text.length > 2400 ? '\n\n[…truncated for chat context…]' : ''}` +
        persistNote,
    };
  },
};
