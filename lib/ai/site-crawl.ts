import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkText } from '@/features/brand-vault/lib/chunkText';
import { embedTexts, embeddingToPgLiteral, isEmbeddingsConfigured } from '@/features/ai-chat/lib/embeddings';

/**
 * Periodic per-tenant site crawl into external_knowledge_chunks, so MonoAI acts as
 * a full brand assistant that knows the client's own website. Strictly tenant-scoped
 * (every row carries tenant_id) and throttled to once per ~7 days per tenant.
 */

const MAX_CONTENT_CHARS = 12_000;
const FETCH_TIMEOUT_MS = 14_000;
const EMBED_BATCH = 16;

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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function normalizeUrl(domainOrUrl: string): string | null {
  const v = domainOrUrl.trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withProto).toString();
  } catch {
    return null;
  }
}

/** Fetch → strip → chunk → embed → replace this source_url's chunks for the tenant. */
export async function crawlSiteIntoKnowledge(
  supabase: SupabaseClient,
  tenantId: string,
  url: string,
): Promise<{ ok: boolean; chunks?: number; error?: string }> {
  if (!isEmbeddingsConfigured()) return { ok: false, error: 'embeddings not configured' };

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'DeepMarka/1.0 (+https://madmonos.com; MonoAI site crawl)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch failed' };
  }
  if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text') && !contentType.includes('html')) {
    return { ok: false, error: `non-text content (${contentType})` };
  }

  const text = stripHtmlToText(await response.text()).slice(0, MAX_CONTENT_CHARS);
  if (text.length < 40) return { ok: false, error: 'insufficient text' };

  const chunks = chunkText(text);
  if (chunks.length === 0) return { ok: false, error: 'no chunks' };

  try {
    await supabase
      .from('external_knowledge_chunks')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('source_url', url);

    for (let offset = 0; offset < chunks.length; offset += EMBED_BATCH) {
      const batch = chunks.slice(offset, offset + EMBED_BATCH);
      const vectors = await embedTexts(batch);
      const rows = batch.map((content, j) => ({
        tenant_id: tenantId,
        source_url: url,
        source_domain: hostOf(url),
        chunk_index: offset + j,
        content,
        embedding: embeddingToPgLiteral(vectors[j]),
      }));
      const { error } = await supabase.from('external_knowledge_chunks').insert(rows);
      if (error) return { ok: false, error: error.message };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'persist failed' };
  }

  return { ok: true, chunks: chunks.length };
}

/**
 * Discover a handful of key pages via sitemap.xml (or robots.txt → Sitemap:).
 * Falls back to just the homepage. Keeps the crawl bounded and polite.
 */
async function discoverSiteUrls(baseUrl: string, max = 8): Promise<string[]> {
  const urls = new Set<string>([baseUrl]);
  const origin = (() => {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return null;
    }
  })();
  if (!origin) return [...urls];

  const sitemapCandidates: string[] = [`${origin}/sitemap.xml`];

  // robots.txt may point at a different sitemap location.
  try {
    const robotsRes = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'DeepMarka/1.0 (+https://madmonos.com; MonoAI site crawl)' },
    });
    if (robotsRes.ok) {
      const txt = await robotsRes.text();
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*sitemap:\s*(\S+)/i);
        if (m?.[1]) sitemapCandidates.unshift(m[1].trim());
      }
    }
  } catch {
    /* robots optional */
  }

  for (const sm of sitemapCandidates.slice(0, 2)) {
    if (urls.size >= max) break;
    try {
      const res = await fetch(sm, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'DeepMarka/1.0 (+https://madmonos.com; MonoAI site crawl)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
      // Prefer shallow pages (home, about, services) — they carry brand context.
      const sorted = locs
        .filter((u) => u.startsWith(origin))
        .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
      for (const u of sorted) {
        if (urls.size >= max) break;
        urls.add(u);
      }
    } catch {
      /* sitemap optional */
    }
  }

  return [...urls].slice(0, max);
}

/** Cron entry: crawl a tenant's own site, throttled to once per ~7 days. */
export async function runTenantSiteCrawl(
  admin: SupabaseClient,
  tenantId: string,
  customDomain: string | null | undefined,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!isEmbeddingsConfigured()) return { ok: false, skipped: true };
  const url = normalizeUrl(customDomain ?? '');
  if (!url) return { ok: false, skipped: true };

  // Throttle: skip if crawled in the last 7 days.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from('technical_logs')
    .select('metadata')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .limit(50);
  if ((recent ?? []).some((r) => (r.metadata as Record<string, unknown> | null)?.source === 'site_crawl')) {
    return { ok: true, skipped: true };
  }

  // Crawl a handful of key pages (sitemap-discovered) so the assistant knows more
  // than just the homepage — services, about, product pages carry brand context.
  const pages = await discoverSiteUrls(url, 8);

  let okCount = 0;
  let chunkTotal = 0;
  let lastError: string | undefined;

  for (const page of pages) {
    const res = await crawlSiteIntoKnowledge(admin, tenantId, page);
    if (res.ok) {
      okCount++;
      chunkTotal += res.chunks ?? 0;
    } else {
      lastError = res.error;
    }
  }

  await admin.from('technical_logs').insert({
    tenant_id: tenantId,
    type: 'system',
    description: okCount
      ? `Site crawl: ${hostOf(url)} — ${okCount}/${pages.length} sayfa, ${chunkTotal} chunk`
      : `Site crawl failed: ${lastError ?? 'unknown'}`,
    metadata: {
      source: 'site_crawl',
      url,
      ok: okCount > 0,
      pages: pages.length,
      pagesOk: okCount,
      chunks: chunkTotal,
      at: new Date().toISOString(),
    },
  });

  return okCount > 0 ? { ok: true } : { ok: false, error: lastError };
}
