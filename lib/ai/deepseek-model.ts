/**
 * Single source of truth for the DeepSeek chat model name.
 *
 * DeepSeek renames its models periodically (e.g. the old `deepseek-chat` alias
 * was dropped in favour of `deepseek-v4-pro` / `deepseek-v4-flash`), and a stale
 * name makes every call fail with a 400 — which surfaces to users as a
 * misleading "add your API key" empty state. Keeping the name here (with an env
 * override) means the next rename is a one-line change, or zero-downtime via env.
 *
 * Override with `DEEPSEEK_MODEL` — set it to `deepseek-v4-flash` for a cheaper,
 * faster model on high-volume paths.
 */
export function deepseekChatModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-pro';
}

/**
 * Faster, cheaper model for latency-sensitive UI calls (short grounded
 * summaries that gate a page render). `deepseek-v4-pro` reasons before
 * answering and takes 15-25s; `deepseek-v4-flash` returns comparable quality for
 * these small structured tasks in ~3s. Override with `DEEPSEEK_FAST_MODEL`.
 */
export function deepseekFastModel(): string {
  return process.env.DEEPSEEK_FAST_MODEL?.trim() || 'deepseek-v4-flash';
}

/**
 * Robustly parse a JSON object out of a chat completion's `content`.
 *
 * Even with `response_format: { type: 'json_object' }`, models occasionally wrap
 * the payload in ```json fences or emit leading prose. A naive `JSON.parse` then
 * throws and the whole feature silently returns null. This strips fences and
 * falls back to the first balanced `{…}` span, so a well-formed object embedded
 * in noise still parses. Returns null only when there's genuinely no JSON.
 */
export function parseDeepseekJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^﻿/, '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the first balanced object span.
  }

  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
