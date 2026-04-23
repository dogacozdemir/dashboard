import { randomUUID } from 'crypto'
import { createDeepSeekClientFacade } from 'src/llm/deepseekFacade.js'
import type { DeepSeekClient } from 'src/llm/deepseekFacade.js'
import type { ClientOptions } from 'src/llm/sdk.js'

export { getDeepSeekApiKey as __getDeepSeekApiKeyForTests } from 'src/llm/deepseekTransport.js'

/**
 * HTTP client for LLM calls. This build uses DeepSeek OpenAI-compatible API only.
 *
 * Environment:
 * - DEEPSEEK_API_KEY (required)
 * - DEEPSEEK_BASE_URL (optional, default https://api.deepseek.com/v1)
 * - DEEPSEEK_MODEL (optional, default deepseek-chat)
 * - DEEPSEEK_FETCH_VERBOSE=1 — Bun fetch verbose logging
 * - DEEPSEEK_HEADER_TIMEOUT_MS — time until response headers on stream (default 60000)
 * - DEEPSEEK_NONSTREAM_TIMEOUT_MS — full non-stream request (default 180000)
 * - DEEPSEEK_MAX_OUTPUT_TOKENS_CAP — completion cap 1–8192 (default 8192)
 *
 * fetchOverride / ClientOptions are accepted for logging, tests, and proxies.
 */
export async function getAnthropicClient({
  fetchOverride: _fetchOverride,
  maxRetries: _maxRetries,
  model: _model,
  source: _source,
  apiKey: _apiKey,
}: {
  apiKey?: string
  maxRetries: number
  model?: string
  fetchOverride?: ClientOptions['fetch']
  source?: string
}): Promise<DeepSeekClient> {
  void _fetchOverride
  void _maxRetries
  void _model
  void _source
  void _apiKey
  return createDeepSeekClientFacade()
}

export const CLIENT_REQUEST_ID_HEADER = 'x-client-request-id'
