import type { SupabaseClient } from '@supabase/supabase-js';
import { embedQuery, embeddingToPgLiteral, isEmbeddingsConfigured } from './embeddings';

export type BrandChunkMatch = {
  id:             string;
  brand_asset_id: string;
  chunk_index:    number;
  content:        string;
  similarity:     number;
  asset_name:     string;
};

export type ExternalChunkMatch = {
  id:          string;
  source_url:  string;
  chunk_index: number;
  content:     string;
  similarity:  number;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Returns a markdown block for system/user augmentation, or null if no hits /
 * embeddings unavailable. Pulls from BOTH uploaded Brand Vault documents and the
 * tenant's crawled site/external knowledge — all strictly tenant-scoped by the RPCs.
 */
export async function retrieveBrandVaultContext(
  supabase: SupabaseClient,
  tenantId: string,
  userMessage: string,
): Promise<string | null> {
  if (!isEmbeddingsConfigured()) return null;

  let embedding: number[];
  try {
    embedding = await embedQuery(userMessage);
  } catch (e) {
    console.error('[retrieveBrandVaultContext] embed', e);
    return null;
  }

  const literal = embeddingToPgLiteral(embedding);

  const [brandRes, extRes] = await Promise.all([
    supabase.rpc('match_brand_knowledge_chunks', {
      query_embedding: literal,
      p_tenant_id:     tenantId,
      match_count:     6,
    }),
    supabase.rpc('match_external_knowledge_chunks', {
      query_embedding: literal,
      p_tenant_id:     tenantId,
      match_count:     6,
    }),
  ]);

  if (brandRes.error) console.error('[retrieveBrandVaultContext] brand rpc', brandRes.error.message);
  if (extRes.error) console.error('[retrieveBrandVaultContext] external rpc', extRes.error.message);

  const brandRows = (brandRes.data ?? []) as BrandChunkMatch[];
  const extRows = ((extRes.data ?? []) as ExternalChunkMatch[]).filter((r) => r.similarity >= 0.2);

  if (brandRows.length === 0 && extRows.length === 0) return null;

  const sections: string[] = [];

  if (brandRows.length > 0) {
    sections.push(
      '**Brand Vault — yüklenen marka dökümanları:**\n\n' +
        brandRows
          .map((row, i) => {
            const pct = Math.min(100, Math.max(0, row.similarity * 100));
            return `### Alıntı ${i + 1} — **${row.asset_name}** (~${pct.toFixed(0)}%)\n${row.content.trim()}`;
          })
          .join('\n\n'),
    );
  }

  if (extRows.length > 0) {
    sections.push(
      '**Site & harici içerik (taranmış):**\n\n' +
        extRows
          .map((row, i) => {
            const pct = Math.min(100, Math.max(0, row.similarity * 100));
            return `### Kaynak ${i + 1} — **${hostOf(row.source_url)}** (~${pct.toFixed(0)}%)\n${row.content.trim()}`;
          })
          .join('\n\n'),
    );
  }

  return (
    '**Aşağıdaki alıntılara dayanarak müşteri markası hakkında cevap ver; uydurma.**\n\n' +
    sections.join('\n\n')
  );
}
