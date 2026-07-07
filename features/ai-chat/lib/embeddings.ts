/**
 * Text embeddings for Brand Vault RAG + DeepMarka crawl vectors.
 *
 * DeepSeek's public API documents chat/reasoning models only — there is no
 * supported production /embeddings endpoint (calls return 404). Embeddings
 * therefore use the local Supabase-aligned gte-small model (384 dimensions)
 * via @xenova/transformers, with an optional DeepSeek attempt when
 * EMBEDDING_PROVIDER=deepseek or auto (falls back to local on failure).
 *
 * Set EMBEDDING_PROVIDER=local to skip any DeepSeek embedding attempt.
 */

import type { FeatureExtractionPipeline } from '@xenova/transformers';

/** Matches Supabase gte-small / Xenova/gte-small output size. */
export const EMBEDDING_DIMENSIONS = 384;

export type EmbeddingProvider = 'local' | 'deepseek' | 'auto';

const LOCAL_MODEL_ID = 'Xenova/gte-small';
const DEEPSEEK_EMBED_URL = 'https://api.deepseek.com/v1/embeddings';
const DEEPSEEK_EMBED_MODEL = process.env.DEEPSEEK_EMBEDDING_MODEL ?? 'deepseek-embedding';

let localPipeline: FeatureExtractionPipeline | null = null;
let localPipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

function resolveProvider(): EmbeddingProvider {
  const raw = (process.env.EMBEDDING_PROVIDER ?? 'auto').trim().toLowerCase();
  if (raw === 'local' || raw === 'deepseek' || raw === 'auto') return raw;
  return 'auto';
}

/** True when local inference is always available, or DeepSeek key exists for deepseek-only mode. */
export function isEmbeddingsConfigured(): boolean {
  const provider = resolveProvider();
  if (provider === 'local' || provider === 'auto') return true;
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

async function getLocalPipeline(): Promise<FeatureExtractionPipeline> {
  if (localPipeline) return localPipeline;
  if (!localPipelinePromise) {
    localPipelinePromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      const pipe = await pipeline('feature-extraction', LOCAL_MODEL_ID, {
        quantized: true,
      });
      localPipeline = pipe;
      return pipe;
    })();
  }
  return localPipelinePromise;
}

function tensorToVector(output: { data: Float32Array | number[] }): number[] {
  const raw = output.data;
  const vec = raw instanceof Float32Array ? Array.from(raw) : [...raw];
  if (vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Local model returned ${vec.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
    );
  }
  return vec;
}

async function embedLocal(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getLocalPipeline();
  const vectors: number[][] = [];
  for (const text of texts) {
    const trimmed = text.trim().slice(0, 8000);
    if (!trimmed) {
      vectors.push(new Array(EMBEDDING_DIMENSIONS).fill(0));
      continue;
    }
    const output = await extractor(trimmed, { pooling: 'mean', normalize: true });
    vectors.push(tensorToVector(output as { data: Float32Array }));
  }
  return vectors;
}

async function embedDeepSeek(texts: string[]): Promise<number[][]> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error('DEEPSEEK_API_KEY is not set');
  }
  if (texts.length === 0) return [];

  const res = await fetch(DEEPSEEK_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_EMBED_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek embeddings failed: ${res.status} ${err.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  const sorted = [...(json.data ?? [])].sort((a, b) => a.index - b.index);
  const vectors = sorted.map((d) => d.embedding);

  for (const vec of vectors) {
    if (vec.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `DeepSeek returned ${vec.length}-dim vectors; database expects ${EMBEDDING_DIMENSIONS}. ` +
          'Use EMBEDDING_PROVIDER=local or re-index after a matching migration.',
      );
    }
  }

  return vectors;
}

/**
 * Generate embedding vectors for one or more text inputs.
 * Default: local gte-small (384d). Optional DeepSeek attempt when configured.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider = resolveProvider();

  if (provider === 'local') {
    return embedLocal(texts);
  }

  if (provider === 'deepseek') {
    return embedDeepSeek(texts);
  }

  // auto: try DeepSeek when key present, else local
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      return await embedDeepSeek(texts);
    } catch (e) {
      console.warn(
        '[embeddings] DeepSeek embedding unavailable; using local gte-small.',
        e instanceof Error ? e.message : e,
      );
    }
  }

  return embedLocal(texts);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}

/** PostgREST / pgvector literal for RPC and inserts. */
export function embeddingToPgLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
