import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPrices, summarizePriceDiff, type DetectedPrice } from './price';
import { deepseekChatModel } from '@/lib/ai/deepseek-model';

/**
 * Competitor change detection.
 *
 * Fetches a competitor page, reduces it to stable text, and hashes it. A new
 * snapshot is written only when the hash differs from the last one — so the
 * history is a change log, not a crawl log. When something changed (and it isn't
 * the first-ever capture) DeepSeek summarises what moved, in Turkish.
 *
 * The core is session-free so the sync cron can call it with the admin client.
 */

const FETCH_TIMEOUT_MS = 14_000;
const MAX_TEXT_CHARS = 8_000;
/** Stored on the snapshot for display + as the diff input on the next run. */
const EXCERPT_CHARS = 4_000;

/** Strip a page down to comparable text — nav/footer/scripts drift constantly. */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Below this much readable text, a big HTML payload is probably a JS shell. */
const SPA_TEXT_THRESHOLD = 400;
const RENDER_TIMEOUT_MS = 20_000;

/**
 * Heuristic for client-rendered (SPA) pages: the server sent plenty of HTML
 * but almost none of it survives as readable text — it's all script and shell.
 */
export function looksLikeSpaShell(html: string, strippedText: string): boolean {
  return strippedText.length < SPA_TEXT_THRESHOLD && html.length > 5_000;
}

/**
 * Rendered-fetch fallback for SPA pages via Jina Reader (r.jina.ai), which
 * executes the page's JavaScript and returns readable text. Works without a
 * key (rate-limited); set JINA_API_KEY for higher limits. Returns null on any
 * failure so the caller can fall back to whatever text it already has.
 */
async function fetchRenderedText(url: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = { Accept: 'text/plain' };
    const key = process.env.JINA_API_KEY?.trim();
    if (key) headers.Authorization = `Bearer ${key}`;

    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const text = (await res.text()).trim();
    return text.length >= 40 ? text : null;
  } catch {
    return null;
  }
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export type TrackResult =
  | { status: 'unchanged' }
  | { status: 'baseline' }
  | { status: 'changed'; summary: string | null; priceChange: string | null }
  | { status: 'error'; error: string };

/**
 * Asks DeepSeek what changed between two versions of a competitor page. Returns
 * null (not an error) when the model isn't configured or declines — the snapshot
 * is still recorded, just without a narrative.
 */
async function summariseChange(
  competitorName: string,
  previousText: string,
  currentText: string,
): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const system =
    'Sen bir pazarlama rekabet analistisin. Bir rakibin web sayfasının eski ve yeni ' +
    'sürümü veriliyor. SADECE anlamlı değişiklikleri (yeni ürün/kampanya, fiyat, ' +
    'mesaj/konumlandırma, yeni sayfa bölümü) 1-3 kısa madde halinde Türkçe özetle. ' +
    'Menü, tarih, çerez metni gibi önemsiz farkları yok say. Anlamlı bir değişiklik ' +
    'yoksa yalnızca "Önemli bir değişiklik yok." yaz.';

  const user =
    `Rakip: ${competitorName}\n\n=== ESKİ SÜRÜM ===\n${previousText.slice(0, 3000)}\n\n` +
    `=== YENİ SÜRÜM ===\n${currentText.slice(0, 3000)}`;

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: deepseekChatModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Checks one competitor and records a snapshot when the page changed. Always
 * stamps `last_checked_at` so the throttle advances even on an unchanged page or
 * a fetch error.
 */
export async function trackCompetitor(
  supabase: SupabaseClient,
  competitor: { id: string; tenant_id: string; name: string; url: string },
): Promise<TrackResult> {
  const stamp = () =>
    supabase
      .from('competitors')
      .update({ last_checked_at: new Date().toISOString() })
      .eq('id', competitor.id);

  let response: Response;
  try {
    response = await fetch(competitor.url, {
      headers: {
        'User-Agent': 'DeepMarka/1.0 (+https://madmonos.com; MonoAI competitor watch)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
  } catch (e) {
    await stamp();
    return { status: 'error', error: e instanceof Error ? e.message : 'fetch failed' };
  }

  if (!response.ok) {
    await stamp();
    return { status: 'error', error: `HTTP ${response.status}` };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text') && !contentType.includes('html')) {
    await stamp();
    return { status: 'error', error: `non-text content (${contentType})` };
  }

  const html = await response.text();
  let text = stripHtmlToText(html).slice(0, MAX_TEXT_CHARS);

  // Client-rendered page? The direct fetch only sees the empty shell — retry
  // through the renderer, which executes the JavaScript. The heuristic fires
  // consistently for the same page, so the hash doesn't flap between modes.
  if (looksLikeSpaShell(html, text)) {
    const rendered = await fetchRenderedText(competitor.url);
    if (rendered && rendered.length > text.length) {
      text = rendered.slice(0, MAX_TEXT_CHARS);
    }
  }

  if (text.length < 40) {
    await stamp();
    return { status: 'error', error: 'insufficient text' };
  }

  const hash = contentHash(text);
  const prices = extractPrices(text);

  const { data: latest } = await supabase
    .from('competitor_snapshots')
    .select('id, content_hash, text_excerpt, prices')
    .eq('competitor_id', competitor.id)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev = latest as
    | { id: string; content_hash: string; text_excerpt: string | null; prices: DetectedPrice[] | null }
    | null;

  // Unchanged: advance the throttle and stop. If the extractor now reads the
  // same page better (e.g. finds product labels it used to miss), refresh the
  // stored prices in place — same page, better data, not a "change".
  if (prev && prev.content_hash === hash) {
    if (JSON.stringify(prev.prices ?? []) !== JSON.stringify(prices)) {
      await supabase
        .from('competitor_snapshots')
        .update({ prices })
        .eq('id', prev.id);
    }
    await stamp();
    return { status: 'unchanged' };
  }

  const isBaseline = !prev;
  const priceChange = isBaseline
    ? null
    : summarizePriceDiff(prev?.prices ?? [], prices);

  let summary = isBaseline
    ? null
    : await summariseChange(competitor.name, prev?.text_excerpt ?? '', text);

  // A price move is the headline — lead with it so it can't get buried.
  if (priceChange) {
    summary = summary ? `💰 Fiyat: ${priceChange}\n${summary}` : `💰 Fiyat: ${priceChange}`;
  }

  const { error: insertErr } = await supabase.from('competitor_snapshots').insert({
    competitor_id: competitor.id,
    tenant_id: competitor.tenant_id,
    content_hash: hash,
    text_excerpt: text.slice(0, EXCERPT_CHARS),
    change_summary: summary,
    changed: !isBaseline,
    prices,
  });

  await stamp();

  if (insertErr) return { status: 'error', error: insertErr.message };
  return isBaseline ? { status: 'baseline' } : { status: 'changed', summary, priceChange };
}

/** Days between automatic re-checks of a competitor. */
export const COMPETITOR_CHECK_INTERVAL_DAYS = 3;

/** True when a competitor is due for an automatic re-check. */
export function isCompetitorDue(lastCheckedAt: string | null, now: Date = new Date()): boolean {
  if (!lastCheckedAt) return true;
  const last = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(last)) return true;
  const ageDays = (now.getTime() - last) / 86_400_000;
  return ageDays >= COMPETITOR_CHECK_INTERVAL_DAYS;
}
