/**
 * Character-based chunking with overlap (MVP; ~800–1200 chars ≈ 200–300 tokens).
 */
export function chunkText(
  raw: string,
  maxChars = 1200,
  overlap = 180,
): string[] {
  const text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return [];

  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end    = Math.min(i + maxChars, text.length);
    let slice    = text.slice(i, end);
    if (end < text.length) {
      const breakAt = slice.lastIndexOf('\n\n');
      if (breakAt > maxChars * 0.45) slice = slice.slice(0, breakAt);
    }
    const trimmed = slice.trim();
    if (trimmed) chunks.push(trimmed);
    const step = Math.max(1, slice.length - overlap);
    i += step;
  }
  return chunks;
}
