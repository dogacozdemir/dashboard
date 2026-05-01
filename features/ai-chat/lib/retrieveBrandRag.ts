import type { SupabaseClient } from '@supabase/supabase-js';
import { embedQuery, embeddingToPgLiteral } from './embeddings';

export type BrandChunkMatch = {
  id:             string;
  brand_asset_id: string;
  chunk_index:    number;
  content:        string;
  similarity:     number;
  asset_name:     string;
};

/**
 * Returns markdown block for system/user augmentation, or null if no hits / no API key.
 */
export async function retrieveBrandVaultContext(
  supabase: SupabaseClient,
  tenantId: string,
  userMessage: string,
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  let embedding: number[];
  try {
    embedding = await embedQuery(userMessage);
  } catch (e) {
    console.error('[retrieveBrandVaultContext] embed', e);
    return null;
  }

  const literal = embeddingToPgLiteral(embedding);

  const { data, error } = await supabase.rpc('match_brand_knowledge_chunks', {
    query_embedding: literal,
    p_tenant_id:     tenantId,
    match_count:     8,
  });

  if (error) {
    console.error('[retrieveBrandVaultContext] rpc', error.message);
    return null;
  }

  const rows = (data ?? []) as BrandChunkMatch[];
  if (rows.length === 0) return null;

  const blocks = rows.map((row, i) => {
    const pct = Math.min(100, Math.max(0, row.similarity * 100));
    return (
      `### Alıntı ${i + 1} — **${row.asset_name}** (benzerlik ~${pct.toFixed(0)}%)\n` +
      row.content.trim()
    );
  });

  return (
    '**Brand Vault (RAG) — yalnızca aşağıdaki alıntılara dayanarak müşteri markası hakkında cevap ver; uydurma.**\n\n' +
    blocks.join('\n\n')
  );
}
