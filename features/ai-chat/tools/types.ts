import type { z } from 'zod';

export interface ToolContext {
  tenantId: string;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export interface MonoAITool<
  TSchema extends z.ZodType = z.ZodType,
> {
  name: string;
  description: string;
  parameters: object;
  inputSchema: TSchema;
  execute(args: z.infer<TSchema>, context: ToolContext): Promise<ToolResult>;
}

export interface DeepSeekToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
}
