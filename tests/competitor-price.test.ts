import { describe, it, expect } from 'vitest';
import {
  parseLocaleAmount,
  extractPrices,
  formatDetectedPrice,
  summarizePriceDiff,
  type DetectedPrice,
} from '@/lib/competitors/price';

describe('parseLocaleAmount', () => {
  it('reads Turkish grouping (dot thousands, comma decimal)', () => {
    expect(parseLocaleAmount('1.299,00')).toBe(1299);
    expect(parseLocaleAmount('1.299,90')).toBe(1299.9);
    expect(parseLocaleAmount('12.345.678,50')).toBe(12345678.5);
  });

  it('reads US grouping (comma thousands, dot decimal)', () => {
    expect(parseLocaleAmount('1,299.00')).toBe(1299);
    expect(parseLocaleAmount('1,299.99')).toBe(1299.99);
  });

  it('reads decimal-only values in both conventions', () => {
    expect(parseLocaleAmount('49,90')).toBe(49.9);
    expect(parseLocaleAmount('19.99')).toBe(19.99);
  });

  it('treats a lone dot before three digits as Turkish thousands', () => {
    // "1.299" on a Turkish page means 1299, not 1.299.
    expect(parseLocaleAmount('1.299')).toBe(1299);
    expect(parseLocaleAmount('1.299.000')).toBe(1299000);
  });

  it('treats a lone comma before three digits as thousands', () => {
    expect(parseLocaleAmount('1,299')).toBe(1299);
  });

  it('handles plain integers', () => {
    expect(parseLocaleAmount('1299')).toBe(1299);
    expect(parseLocaleAmount('49')).toBe(49);
  });

  it('rejects input with no digits', () => {
    expect(parseLocaleAmount('')).toBeNull();
    expect(parseLocaleAmount('abc')).toBeNull();
  });
});

describe('extractPrices', () => {
  it('finds a Turkish lira price with symbol before the number', () => {
    expect(extractPrices('Fiyat: ₺1.299,90 sadece bugün')).toEqual([
      { amount: 1299.9, currency: 'TRY' },
    ]);
  });

  it('finds a Turkish lira price with the symbol after the number', () => {
    expect(extractPrices('Ürün 249,00 ₺ olarak listelendi')).toEqual([
      { amount: 249, currency: 'TRY' },
    ]);
  });

  it('recognises the TL code and maps it to TRY', () => {
    expect(extractPrices('Kampanya: 1.499 TL')).toEqual([{ amount: 1499, currency: 'TRY' }]);
  });

  it('reads USD, EUR and GBP', () => {
    expect(extractPrices('$19.99')).toEqual([{ amount: 19.99, currency: 'USD' }]);
    expect(extractPrices('49,90 €')).toEqual([{ amount: 49.9, currency: 'EUR' }]);
    expect(extractPrices('£12.00')).toEqual([{ amount: 12, currency: 'GBP' }]);
  });

  it('collects multiple prices and attributes each to its own product', () => {
    const prices = extractPrices('Başlangıç ₺199, Pro ₺499, Kurumsal ₺999');
    expect(prices).toEqual([
      { amount: 199, currency: 'TRY', label: 'Başlangıç' },
      { amount: 499, currency: 'TRY', label: 'Pro' },
      { amount: 999, currency: 'TRY', label: 'Kurumsal' },
    ]);
  });

  it('de-duplicates a price that appears twice', () => {
    expect(extractPrices('₺249 ₺249')).toEqual([{ amount: 249, currency: 'TRY' }]);
  });

  it('upgrades an unlabelled sighting when a labelled one appears', () => {
    const prices = extractPrices('₺249\nPro paket ₺249');
    expect(prices).toEqual([{ amount: 249, currency: 'TRY', label: 'Pro paket' }]);
  });

  it('reads the product name from the line above the price', () => {
    expect(extractPrices('Kurumsal Paket\n₺2.499')).toEqual([
      { amount: 2499, currency: 'TRY', label: 'Kurumsal Paket' },
    ]);
  });

  it('finds the product name across blank lines (stripped e-commerce grids)', () => {
    // stripHtmlToText turns wrapper tags into runs of blank/whitespace lines
    // between a product card's name and its price.
    const text = "Retroline Masa Lambası 10'lu Şarj İstasyonu\n\n \n\n \n\n \n\n 9.900,00 TL";
    expect(extractPrices(text)).toEqual([
      { amount: 9900, currency: 'TRY', label: "Retroline Masa Lambası 10'lu Şarj İstasyonu" },
    ]);
  });

  it('ignores generic words like "Fiyat" as labels', () => {
    expect(extractPrices('Fiyat: ₺1.299,90 sadece bugün')).toEqual([
      { amount: 1299.9, currency: 'TRY' },
    ]);
  });

  it('keeps two products that share the same price', () => {
    const prices = extractPrices('Aylık plan ₺99\nEk kullanıcı ₺99');
    expect(prices).toHaveLength(2);
    expect(prices.map((p) => p.label).sort()).toEqual(['Aylık plan', 'Ek kullanıcı']);
  });

  it('ignores numbers with no currency marker (phones, dates, IDs)', () => {
    expect(extractPrices('Telefon: 0212 345 67 89, kayıt no 2026-07-21')).toEqual([]);
  });

  it('does not match TL inside an unrelated word', () => {
    // "HTML" / "title" contain "tl" — word boundaries must prevent a match.
    expect(extractPrices('Bu HTML başlığı title etiketiyle yazıldı 500')).toEqual([]);
  });

  it('drops implausibly large numbers', () => {
    expect(extractPrices('Sipariş ₺999999999999')).toEqual([]);
  });
});

describe('formatDetectedPrice', () => {
  it('renders TRY with Turkish grouping', () => {
    expect(formatDetectedPrice({ amount: 1299.9, currency: 'TRY' })).toMatch(/₺1\.299,9/);
    expect(formatDetectedPrice({ amount: 999, currency: 'TRY' })).toBe('₺999');
  });

  it('renders other currencies with their symbol', () => {
    expect(formatDetectedPrice({ amount: 19.99, currency: 'USD' })).toBe('$19.99');
    expect(formatDetectedPrice({ amount: 12, currency: 'GBP' })).toBe('£12');
  });
});

describe('summarizePriceDiff', () => {
  const p = (amount: number, currency: DetectedPrice['currency'] = 'TRY'): DetectedPrice => ({
    amount,
    currency,
  });

  it('returns null when the price set is unchanged (order-independent)', () => {
    expect(summarizePriceDiff([p(199), p(499)], [p(499), p(199)])).toBeNull();
  });

  it('shows a single price rise as an up arrow', () => {
    const out = summarizePriceDiff([p(249)], [p(299)]);
    expect(out).toBe('₺249 → ₺299 ↑');
  });

  it('shows a single price drop as a down arrow', () => {
    const out = summarizePriceDiff([p(299)], [p(249)]);
    expect(out).toBe('₺299 → ₺249 ↓');
  });

  it('lists added and removed prices when it is not a clean swap', () => {
    const out = summarizePriceDiff([p(199)], [p(199), p(399)]);
    expect(out).toContain('Yeni: ₺399');
  });

  it('matches by product label and names the product in the move', () => {
    const out = summarizePriceDiff(
      [{ amount: 249, currency: 'TRY', label: 'Pro' }, { amount: 999, currency: 'TRY', label: 'Kurumsal' }],
      [{ amount: 299, currency: 'TRY', label: 'Pro' }, { amount: 999, currency: 'TRY', label: 'Kurumsal' }],
    );
    expect(out).toBe('Pro: ₺249 → ₺299 ↑');
  });

  it('reports label-attributed additions', () => {
    const out = summarizePriceDiff(
      [],
      [{ amount: 149, currency: 'TRY', label: 'Mini' }],
    );
    expect(out).toBe('Yeni: Mini ₺149');
  });

  it('reports a removed price', () => {
    const out = summarizePriceDiff([p(199), p(399)], [p(199)]);
    expect(out).toContain('Kaldırılan: ₺399');
  });

  it('does not treat a cross-currency pair as a single swap', () => {
    const out = summarizePriceDiff([p(100, 'USD')], [p(100, 'EUR')]);
    expect(out).toContain('Yeni');
    expect(out).toContain('Kaldırılan');
  });
});
