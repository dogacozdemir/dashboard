import { webFetchTool }    from './web-fetch';
import { webSearchTool }   from './web-search';
import { assetSearchTool } from './asset-search';
import type { MonoAITool } from './types';

// generate_pdf is intentionally excluded here — PDF generation is triggered
// automatically server-side after the model produces its final text reply.
// This avoids the model needing to embed large document content inside a tool call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MONO_AI_TOOLS: MonoAITool<any>[] = [
  webFetchTool,
  webSearchTool,
  assetSearchTool,
];

/**
 * Returns tool definitions in the OpenAI/DeepSeek function-calling format.
 * Sent as the `tools` parameter to the chat completions API.
 */
export function getDeepSeekToolSchemas() {
  return MONO_AI_TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name:        tool.name,
      description: tool.description,
      parameters:  tool.parameters,
    },
  }));
}

/**
 * Look up a registered tool by name.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findTool(name: string): MonoAITool<any> | undefined {
  return MONO_AI_TOOLS.find((t) => t.name === name);
}
