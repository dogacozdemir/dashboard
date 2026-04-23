import { z } from 'zod';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const MAX_RESULTS   = 5;
const SNIPPET_CHARS = 400;

const inputSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(400)
    .describe('The search query to look up on the web'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(MAX_RESULTS)
    .describe('Maximum number of search results to return (1–10, default 5)'),
});

type Input = z.infer<typeof inputSchema>;

interface TavilyResult {
  title:   string;
  url:     string;
  content: string;
  score?:  number;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

export const webSearchTool: MonoAITool<typeof inputSchema> = {
  name: 'web_search',
  description:
    'Search the web for current, real-world information. ' +
    'Use this for: competitor research, industry news, market trends, ' +
    'platform algorithm updates, ad benchmark data, or any topic requiring ' +
    'up-to-date information beyond training knowledge. ' +
    'Requires TAVILY_API_KEY environment variable.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      max_results: {
        type: 'number',
        description: 'Number of results (1–10, default 5)',
      },
    },
    required: ['query'],
  },
  inputSchema,

  async execute(args: Input, _context: ToolContext): Promise<ToolResult> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        content:
          'Web search is not configured for this workspace. ' +
          'To enable it, add TAVILY_API_KEY to your environment variables. ' +
          'Get a free key at https://tavily.com',
        isError: true,
      };
    }

    const parsed = inputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        isError: true,
      };
    }

    const { query, max_results } = parsed.data;

    let response: Response;
    try {
      response = await fetch('https://api.tavily.com/search', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          api_key:      apiKey,
          query,
          search_depth: 'basic',
          max_results:  max_results ?? MAX_RESULTS,
          include_answer: true,
        }),
        signal: AbortSignal.timeout(6_000),
      });
    } catch (err) {
      return {
        content: `Web search request failed: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        content: `Tavily API error (${response.status}): ${text.slice(0, 200)}`,
        isError: true,
      };
    }

    const data = (await response.json()) as TavilyResponse;

    if (!data.results?.length) {
      return { content: `No results found for: "${query}"` };
    }

    const lines: string[] = [`**Web search results for:** "${query}"\n`];

    if (data.answer) {
      lines.push(`**Summary:** ${data.answer}\n`);
    }

    lines.push('**Sources:**\n');
    for (const [i, result] of data.results.entries()) {
      const snippet = result.content?.slice(0, SNIPPET_CHARS) ?? '';
      lines.push(
        `${i + 1}. **${result.title}**\n` +
        `   ${result.url}\n` +
        `   ${snippet}${snippet.length >= SNIPPET_CHARS ? '…' : ''}\n`,
      );
    }

    return { content: lines.join('\n') };
  },
};
