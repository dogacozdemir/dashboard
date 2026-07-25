/**
 * Title + preamble handling for generated documents. Lives outside the
 * `'use server'` action file, which may only export async functions.
 */

/**
 * Chat replies routinely open with a conversational preamble ("Tabii ki, ...
 * hazırlayıp sunuyorum."). Using that as a document title produced PDFs titled
 * with the assistant's small talk, so preambles are rejected outright.
 */
const PREAMBLE_RE =
  /^(tabii|elbette|tabi ki|memnuniyetle|hemen|işte|iste|buyurun|sure|certainly|of course|here(?:'s| is)|absolutely|happy to|i'?ll|i will|let me)\b/i;

/** A title should name the subject, not narrate the act of producing it. */
function looksLikePreamble(line: string): boolean {
  const t = line.trim().replace(/\*\*/g, '');
  if (!t) return true;
  if (PREAMBLE_RE.test(t)) return true;
  // "…sunuyorum.", "…hazırladım." — first-person delivery narration.
  if (/\b(sunuyorum|hazırlıyorum|hazırladım|oluşturuyorum|oluşturdum|raporluyorum)\b/i.test(t)) return true;
  if (/\b(i have (?:created|prepared)|below is|as requested)\b/i.test(t)) return true;
  return false;
}

export function extractDocumentTitle(content: string, fallback: string): string {
  const clean = (s: string) => s.replace(/\*\*/g, '').replace(/[#*`]/g, '').trim();
  const usable = (s: string) => s.length > 3 && s.length <= 140 && !looksLikePreamble(s);

  // 1. An H1 is the author's own document title — the strongest signal.
  for (const m of content.matchAll(/^#\s+(.+)$/gm)) {
    const candidate = clean(m[1]);
    if (usable(candidate)) return candidate.slice(0, 100);
  }

  // 2. Otherwise the first substantive prose line. This must beat H2/H3, which
  //    are section headings ("## Ücretli Medya") and make terrible titles.
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || /^#{1,6}\s/.test(line)) continue;
    if (/^[-*+>|]/.test(line) || /^\d+\./.test(line)) continue;
    const candidate = clean(line);
    if (candidate.length < 9 || !usable(candidate)) continue;
    return candidate.slice(0, 100);
  }

  // 3. Only now fall back to a section heading.
  for (const m of content.matchAll(/^#{2,3}\s+(.+)$/gm)) {
    const candidate = clean(m[1]);
    if (usable(candidate)) return candidate.slice(0, 100);
  }

  // 4. What the user actually asked for.
  const ask = clean(fallback);
  if (usable(ask)) return ask.slice(0, 80);

  return 'Madmonos Raporu';
}

/**
 * Drops the same conversational opener from the document body — it belongs in
 * the chat bubble, not on page one of a client-facing report.
 */
export function stripPreamble(content: string): string {
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    // Stop at the first line that carries real content.
    if (/^#{1,3}\s/.test(line) || !looksLikePreamble(line)) break;
    i++;
  }
  const out = lines.slice(i).join('\n').trim();
  return out || content.trim();
}
