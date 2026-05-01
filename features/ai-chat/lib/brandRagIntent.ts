/** User asks about Madmonos the agency — do not inject tenant Brand Vault RAG. */
export function isAgencyFocusedQuestion(message: string): boolean {
  const m = message.trim();
  if (m.length < 2) return false;
  return (
    /madmonos\b/i.test(m) ||
    /\bajans(ınız|ımız|iniz)?\b/i.test(m) ||
    /siz\s+(hangi|ne\s+yap|neyi\s+yap)/i.test(m) ||
    /what\s+does\s+madmonos|what\s+is\s+madmonos|madmonos\s+do\b/i.test(m) ||
    /frictionless\s+.*\b(agency|ajans)/i.test(m)
  );
}

/**
 * Tenant brand / own-company questions — retrieve Brand Vault chunks.
 */
export function shouldSearchBrandVault(message: string): boolean {
  if (isAgencyFocusedQuestion(message)) return false;
  const m = message;
  return (
    /\bbiz\b/i.test(m) ||
    /şirketimiz|şirketim\b/i.test(m) ||
    /markam(ız)?\b/i.test(m) ||
    /brand\s+vault|\bvault\b/i.test(m) ||
    /marka\s+rehber/i.test(m) ||
    /renk(ler)?im(iz)?\b/i.test(m) ||
    /\blogo\b/i.test(m) ||
    /font(lar)?ım(ız)?\b/i.test(m) ||
    /ses\s+ton|tone\s+of\s+voice/i.test(m) ||
    /değerler(imiz)?|misyon|vizyon/i.test(m) ||
    /hakkımızda/i.test(m) ||
    /ne\s+iş\s+yap|ne\s+yapıyoruz/i.test(m) ||
    /ürün(ler)?im(iz)?\b/i.test(m) ||
    /hedef\s+kitle|konumlandır|positioning/i.test(m) ||
    /guideline|brand\s+book|color\s+palette/i.test(m) ||
    /yüklediğim|yüklenen\s+dosya/i.test(m) ||
    /our\s+company|our\s+brand|mission|vision|values/i.test(m)
  );
}
