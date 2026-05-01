const EMBED_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * OpenAI embeddings for Brand Vault RAG (pgvector column size must match).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  if (texts.length === 0) return [];

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${key}`,
    },
    body: JSON.stringify({
      model:      EMBED_MODEL,
      input:      texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  const sorted = [...json.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}

/** PostgREST / pgvector literal for RPC and inserts. */
export function embeddingToPgLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
