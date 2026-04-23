import { z } from 'zod';
import type { MonoAITool, ToolContext, ToolResult } from './types';

const MAX_CONTENT_CHARS = 8_000;
const FETCH_TIMEOUT_MS  = 12_000;

const inputSchema = z.object({
  url: z
    .string()
    .url()
    .describe('The full URL to fetch (must start with http:// or https://)'),
  focus: z
    .string()
    .optional()
    .describe('Optional: what to focus on or extract from the page content'),
});

type Input = z.infer<typeof inputSchema>;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi,  '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&quot;/g,  '"')
    .replace(/&#39;/g,   "'")
    .replace(/\s{3,}/g,  '\n\n')
    .trim();
}

export const webFetchTool: MonoAITool<typeof inputSchema> = {
  name: 'web_fetch',
  description:
    'Fetch and read the text content of a public web page. ' +
    'Use this to get up-to-date information from a specific URL, ' +
    'read competitor pages, check landing pages, or retrieve any public web content. ' +
    'Does NOT work for authenticated or private pages.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL to fetch (must start with http:// or https://)',
      },
      focus: {
        type: 'string',
        description: 'Optional: what to focus on or extract from the page',
      },
    },
    required: ['url'],
  },
  inputSchema,

  async execute(args: Input, _context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        isError: true,
      };
    }

    const { url, focus } = parsed.data;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'monoAI/1.0 (+https://madmonos.com; AI research assistant)',
          'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'follow',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: `Failed to fetch ${url}: ${msg}`,
        isError: true,
      };
    }

    if (!response.ok) {
      return {
        content: `HTTP ${response.status} ${response.statusText} — could not retrieve ${url}`,
        isError: true,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text')) {
      return {
        content: `The URL returned a non-text content type (${contentType}). Only HTML or plain-text pages can be read.`,
        isError: true,
      };
    }

    const raw  = await response.text();
    const text = stripHtml(raw);
    const truncated = text.length > MAX_CONTENT_CHARS;
    const preview   = text.slice(0, MAX_CONTENT_CHARS);

    const focusNote = focus ? `\n\n**Focus request:** ${focus}\n` : '';
    const truncNote = truncated
      ? `\n\n[Content truncated — showing first ${MAX_CONTENT_CHARS} characters of ${text.length} total]`
      : '';

    return {
      content:
        `**Page content from:** ${url}${focusNote}\n\n` +
        `---\n${preview}${truncNote}`,
    };
  },
};
