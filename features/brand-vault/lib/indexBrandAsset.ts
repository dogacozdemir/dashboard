import type { SupabaseClient } from '@supabase/supabase-js';
import { getS3ObjectBuffer } from '@/lib/storage/s3';
import { embedTexts, embeddingToPgLiteral } from '@/features/ai-chat/lib/embeddings';
import { chunkText } from './chunkText';
import type { BrandAssetType } from '../types';

const MAX_INDEX_BYTES = 15 * 1024 * 1024; // 15 MB
const EMBED_BATCH     = 16;

async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeHint: string | null,
  assetType: BrandAssetType,
): Promise<string | null> {
  const lower = fileName.toLowerCase();
  const isPdf =
    mimeHint?.includes('pdf') ||
    lower.endsWith('.pdf') ||
    assetType === 'brand-book';

  if (isPdf) {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const textResult = await parser.getText();
      await parser.destroy();
      const text = (textResult.text ?? '').trim();
      return text.length > 0 ? text : null;
    } catch (e) {
      try {
        await parser.destroy();
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  if (mimeHint?.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    const text = buffer.toString('utf8').trim();
    return text.length > 0 ? text : null;
  }

  return null;
}

export async function indexBrandAsset(
  supabase: SupabaseClient,
  assetId: string,
): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('brand_assets')
    .select('id, tenant_id, name, type, storage_key, url')
    .eq('id', assetId)
    .maybeSingle();

  if (fetchErr || !row) {
    console.error('[indexBrandAsset] fetch', fetchErr?.message);
    return;
  }

  const tenantId = row.tenant_id as string;
  const assetType = row.type as BrandAssetType;

  await supabase
    .from('brand_assets')
    .update({
      indexing_status: 'pending',
      indexing_error:  null,
    })
    .eq('id', assetId);

  try {
    if (assetType === 'font') {
      await supabase
        .from('brand_assets')
        .update({
          indexing_status: 'skipped',
          indexed_at:      new Date().toISOString(),
          indexing_error:  null,
        })
        .eq('id', assetId);
      return;
    }

    const storageKey = row.storage_key as string | null;
    if (!storageKey?.trim()) {
      await supabase
        .from('brand_assets')
        .update({
          indexing_status: 'failed',
          indexing_error:  'storage_key missing — re-upload this file to enable indexing',
          indexed_at:      new Date().toISOString(),
        })
        .eq('id', assetId);
      return;
    }

    const buffer = await getS3ObjectBuffer('brand', storageKey);
    if (buffer.length > MAX_INDEX_BYTES) {
      await supabase
        .from('brand_assets')
        .update({
          indexing_status: 'failed',
          indexing_error:  `File too large for indexing (max ${MAX_INDEX_BYTES / 1024 / 1024} MB)`,
          indexed_at:      new Date().toISOString(),
        })
        .eq('id', assetId);
      return;
    }

    const mimeHint =
      row.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null;

    const fullText = await extractTextFromBuffer(
      buffer,
      row.name,
      mimeHint,
      assetType,
    );

    if (!fullText) {
      await supabase
        .from('brand_assets')
        .update({
          indexing_status: 'skipped',
          indexed_at:      new Date().toISOString(),
          indexing_error:  null,
        })
        .eq('id', assetId);
      return;
    }

    const chunks = chunkText(fullText);
    if (chunks.length === 0) {
      await supabase
        .from('brand_assets')
        .update({
          indexing_status: 'skipped',
          indexed_at:      new Date().toISOString(),
          indexing_error:  null,
        })
        .eq('id', assetId);
      return;
    }

    await supabase.from('brand_knowledge_chunks').delete().eq('brand_asset_id', assetId);

    if (!process.env.OPENAI_API_KEY) {
      await supabase
        .from('brand_assets')
        .update({
          indexing_status: 'failed',
          indexing_error:  'OPENAI_API_KEY not configured',
          indexed_at:      new Date().toISOString(),
        })
        .eq('id', assetId);
      return;
    }

    for (let offset = 0; offset < chunks.length; offset += EMBED_BATCH) {
      const batch     = chunks.slice(offset, offset + EMBED_BATCH);
      const vectors   = await embedTexts(batch);
      const insertRows = batch.map((content, j) => ({
        tenant_id:      tenantId,
        brand_asset_id: assetId,
        chunk_index:    offset + j,
        content,
        embedding:      embeddingToPgLiteral(vectors[j]),
      }));

      const { error: insErr } = await supabase.from('brand_knowledge_chunks').insert(insertRows);
      if (insErr) {
        throw new Error(insErr.message);
      }
    }

    await supabase
      .from('brand_assets')
      .update({
        indexing_status: 'ready',
        indexed_at:      new Date().toISOString(),
        indexing_error:  null,
      })
      .eq('id', assetId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[indexBrandAsset]', msg);
    await supabase
      .from('brand_assets')
      .update({
        indexing_status: 'failed',
        indexing_error:  msg.slice(0, 500),
        indexed_at:      new Date().toISOString(),
      })
      .eq('id', assetId);
  }
}
