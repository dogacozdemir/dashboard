/**
 * Price detection for competitor pages. Pure and locale-aware: Turkish pages
 * write "1.299,00 ₺" (dot thousands, comma decimal) while US pages write
 * "$1,299.00" — getting the separators backwards turns ₺1.299 into ₺1.30, so the
 * parsing is careful and heavily tested.
 *
 * No DB, no network — safe to unit-test in isolation.
 */

export type PriceCurrency = 'TRY' | 'USD' | 'EUR' | 'GBP';

export interface DetectedPrice {
  amount: number;
  currency: PriceCurrency;
  /** Product/plan the price belongs to, read from the surrounding text. */
  label?: string;
}

const SYMBOL_TO_CURRENCY: Record<string, PriceCurrency> = {
  '₺': 'TRY',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
};

const CODE_TO_CURRENCY: Record<string, PriceCurrency> = {
  TL: 'TRY',
  TRY: 'TRY',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
};

/** Prices outside this range are almost certainly noise (IDs, phone numbers). */
const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 100_000_000;

/**
 * Parses a locale-formatted numeric string into a number. Handles both
 * "1.299,00" (TR/EU) and "1,299.00" (US), plain "1299", and decimal-only
 * "49,90" / "19.99".
 */
export function parseLocaleAmount(raw: string): number | null {
  const s = raw.trim();
  if (!/\d/.test(s)) return null;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  let normalized: string;

  if (hasDot && hasComma) {
    // Both present — whichever comes last is the decimal separator.
    const decChar = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const thouChar = decChar === '.' ? ',' : '.';
    normalized = s.split(thouChar).join('').replace(decChar, '.');
  } else if (hasComma) {
    const parts = s.split(',');
    // "49,90" → decimal; "1,299" or "1,299,000" → thousands.
    normalized =
      parts.length === 2 && parts[1].length === 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length === 2) {
      normalized = s; // "19.99" — decimal
    } else {
      normalized = parts.join(''); // "1.299" / "1.299.000" — Turkish thousands
    }
  } else {
    normalized = s;
  }

  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

// A currency symbol or code, then a number, or a number then a symbol/code.
// Codes use word boundaries so "TL" doesn't match inside "HTML" / "title".
// Grouped form ("1.299", "1.299,90") requires at least one separator group;
// otherwise the plain form consumes the WHOLE digit run so a giant number like
// "999999999999" can't be truncated to a plausible-looking "999".
const NUM = '(?:\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
const CUR = '(₺|\\$|€|£|\\bTL\\b|\\bTRY\\b|\\bUSD\\b|\\bEUR\\b|\\bGBP\\b)';

const PRICE_RE = new RegExp(`${CUR}\\s?(${NUM})|(${NUM})\\s?${CUR}`, 'gi');

function currencyOf(token: string): PriceCurrency | null {
  const t = token.toUpperCase();
  return SYMBOL_TO_CURRENCY[token] ?? CODE_TO_CURRENCY[t] ?? null;
}

const MAX_LABEL_CHARS = 60;

/** Cleans surrounding text into a usable product label, or null if it's noise. */
function cleanLabel(raw: string): string | null {
  const label = raw
    .replace(/[•·▪◦*\-–—>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.=]+/g, '')
    .replace(/[\s:;,.=]+$/g, '')
    .trim();

  if (label.length < 2 || label.length > 120) return null;
  // A "label" that is itself numbers/currency is not a product name.
  if (/^[\d.,\s₺$€£]+$/.test(label)) return null;
  if (/^(TL|TRY|USD|EUR|GBP)$/i.test(label)) return null;
  // Generic price words name nothing — "Fiyat: ₺99" has no product in it.
  if (/^(fiyat|fiyatı|fiyatlar|ücret|tutar|price|prices|cost|kampanya|ürün|product|sadece|only|now|şimdi)$/i.test(label)) {
    return null;
  }

  return label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label;
}

/** True when a line is essentially just a price (so it can't serve as a label). */
function isPriceOnlyLine(line: string): boolean {
  const stripped = line.replace(PRICE_RE, ' ').trim();
  return cleanLabel(stripped) === null;
}

/**
 * Extracts every currency-tagged amount from page text, with the product it
 * belongs to when the surrounding text names one: first the text before the
 * price on the same line, else the nearest preceding line that isn't itself a
 * price. Requires a currency marker adjacent to the number, which filters out
 * phone numbers, dates and IDs. De-duplicated and sorted ascending by amount.
 */
export function extractPrices(text: string): DetectedPrice[] {
  const out: DetectedPrice[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Labels come from the segment between this match and the previous one, so
    // "Başlangıç ₺199, Pro ₺499" yields "Başlangıç" and "Pro" — not a mashup.
    let segmentStart = 0;

    for (const m of line.matchAll(PRICE_RE)) {
      const currencyToken = m[1] ?? m[4];
      const numberToken = m[2] ?? m[3];
      const matchStart = m.index ?? 0;
      const matchEnd = matchStart + m[0].length;
      if (!currencyToken || !numberToken) continue;

      const currency = currencyOf(currencyToken);
      if (!currency) {
        segmentStart = matchEnd;
        continue;
      }

      const amount = parseLocaleAmount(numberToken);
      if (amount === null || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
        segmentStart = matchEnd;
        continue;
      }

      // Same-line segment first ("Pro paket: ₺499"), else the nearest non-blank
      // line above ("Pro paket\n₺499"). Stripped e-commerce grids often leave
      // many whitespace-only lines between a product name and its price, so
      // blanks are skipped without counting against the lookback window.
      let label = cleanLabel(line.slice(segmentStart, matchStart));
      if (!label) {
        for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
          const prevLine = lines[j];
          if (!prevLine.trim()) continue;
          if (!isPriceOnlyLine(prevLine)) label = cleanLabel(prevLine);
          break;
        }
      }
      segmentStart = matchEnd;

      const rounded = Math.round(amount * 100) / 100;

      // Dedupe by (currency, amount): an unlabelled sighting of a price we
      // already have adds nothing; a labelled one upgrades the unlabelled entry.
      const twin = out.find((p) => p.currency === currency && p.amount === rounded);
      if (twin) {
        if (label && !twin.label) twin.label = label;
        else if (!label || twin.label === label) continue;
        else out.push({ amount: rounded, currency, label }); // two products, same price
        continue;
      }

      out.push(label ? { amount: rounded, currency, label } : { amount: rounded, currency });
    }
  }

  return out.sort((a, b) => a.amount - b.amount);
}

const CURRENCY_SYMBOL: Record<PriceCurrency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/** Human-readable price, e.g. "₺1.299,90". Turkish grouping for TRY. */
export function formatDetectedPrice(p: DetectedPrice): string {
  const locale = p.currency === 'TRY' ? 'tr-TR' : 'en-US';
  const hasFraction = p.amount % 1 !== 0;
  const body = p.amount.toLocaleString(locale, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOL[p.currency]}${body}`;
}

function sameSet(a: DetectedPrice[], b: DetectedPrice[]): boolean {
  if (a.length !== b.length) return false;
  const key = (p: DetectedPrice) => `${p.currency}:${p.amount}:${p.label ?? ''}`;
  const keyed = new Set(a.map(key));
  return b.every((p) => keyed.has(key(p)));
}

/** "Pro: ₺249 → ₺299 ↑" — the arrow shows the direction of the move. */
function describeMove(from: DetectedPrice, to: DetectedPrice): string {
  const arrow = to.amount > from.amount ? '↑' : '↓';
  const prefix = to.label ? `${to.label}: ` : '';
  return `${prefix}${formatDetectedPrice(from)} → ${formatDetectedPrice(to)} ${arrow}`;
}

function describeOne(p: DetectedPrice): string {
  return p.label ? `${p.label} ${formatDetectedPrice(p)}` : formatDetectedPrice(p);
}

/**
 * Describes how the detected prices moved between two checks. Returns null when
 * nothing meaningful changed. Labelled prices are matched by product name, so a
 * plan's price move reads as "Pro: ₺249 → ₺299 ↑"; unlabelled leftovers fall
 * back to set comparison ("Yeni: … · Kaldırılan: …").
 */
export function summarizePriceDiff(
  previous: DetectedPrice[],
  current: DetectedPrice[],
): string | null {
  if (sameSet(previous, current)) return null;

  const parts: string[] = [];
  const prevRest = [...previous];
  const currRest = [...current];

  // 1. Match by product label within the same currency — the strongest signal.
  for (const curr of [...currRest]) {
    if (!curr.label) continue;
    const idx = prevRest.findIndex(
      (p) => p.label === curr.label && p.currency === curr.currency,
    );
    if (idx === -1) continue;
    const prev = prevRest[idx];
    prevRest.splice(idx, 1);
    currRest.splice(currRest.indexOf(curr), 1);
    if (prev.amount !== curr.amount) parts.push(describeMove(prev, curr));
  }

  // 2. What's left: unmatched additions and removals.
  const key = (p: DetectedPrice) => `${p.currency}:${p.amount}`;
  const prevKeys = new Set(prevRest.map(key));
  const currKeys = new Set(currRest.map(key));
  const added = currRest.filter((p) => !prevKeys.has(key(p)));
  const removed = prevRest.filter((p) => !currKeys.has(key(p)));

  // A single unlabelled price moving within one currency is still a clean swap.
  if (
    parts.length === 0 &&
    added.length === 1 &&
    removed.length === 1 &&
    added[0].currency === removed[0].currency
  ) {
    return describeMove(removed[0], added[0]);
  }

  if (added.length) parts.push(`Yeni: ${added.map(describeOne).join(', ')}`);
  if (removed.length) parts.push(`Kaldırılan: ${removed.map(describeOne).join(', ')}`);

  return parts.length ? parts.join(' · ') : null;
}
