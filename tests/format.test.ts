import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  currencySymbol,
  formatNumber,
  formatPercent,
  formatFileSize,
} from '@/lib/utils/format';

/** Strip NBSP/narrow-NBSP so assertions don't depend on ICU spacing. */
const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatCurrency', () => {
  it('defaults to the tenant-first currency, not USD', () => {
    expect(DEFAULT_CURRENCY).toBe('TRY');
    expect(norm(formatCurrency(1234))).toContain('₺');
  });

  it('groups Turkish amounts with dots, not commas', () => {
    // The old hardcoded en-US path rendered this as "$1,234".
    expect(norm(formatCurrency(1234, 'TRY'))).toContain('1.234');
  });

  it('honours a tenant on a different currency', () => {
    expect(norm(formatCurrency(1234, 'USD'))).toBe('$1,234');
    expect(norm(formatCurrency(1234, 'EUR'))).toContain('€');
  });

  it('is case-insensitive about the ISO code', () => {
    expect(formatCurrency(50, 'usd')).toBe(formatCurrency(50, 'USD'));
  });

  it('respects the fraction-digit argument', () => {
    expect(norm(formatCurrency(12.345, 'USD', 2))).toBe('$12.35');
    expect(norm(formatCurrency(12.345, 'USD', 0))).toBe('$12');
  });

  it('falls back to a plain grouped number for an unknown code', () => {
    const out = norm(formatCurrency(1000, 'XYZZY'));
    expect(out).toContain('1.000');
    expect(out).toContain('XYZZY');
  });

  it('treats an empty currency as the default rather than throwing', () => {
    expect(norm(formatCurrency(10, ''))).toContain('₺');
  });

  it('formats negative amounts without losing the sign', () => {
    expect(norm(formatCurrency(-500, 'USD'))).toContain('500');
    expect(norm(formatCurrency(-500, 'USD'))).toMatch(/-|\(/);
  });
});

describe('currencySymbol', () => {
  it('returns the symbol used by metric-card prefixes', () => {
    expect(currencySymbol('TRY')).toBe('₺');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('GBP')).toBe('£');
  });

  it('defaults to the Turkish lira', () => {
    expect(currencySymbol()).toBe('₺');
  });

  it('echoes the code back when it has no known symbol', () => {
    expect(currencySymbol('XYZZY')).toBe('XYZZY');
  });
});

describe('formatNumber', () => {
  it('abbreviates at thousand and million boundaries', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1_000)).toBe('1.0K');
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });

  it('does not abbreviate just below a boundary', () => {
    expect(formatNumber(999_999)).toBe('1000.0K');
  });
});

describe('formatPercent', () => {
  it('prefixes growth with an explicit plus', () => {
    expect(formatPercent(12.34)).toBe('+12.3%');
    expect(formatPercent(-8.5)).toBe('-8.5%');
    expect(formatPercent(0)).toBe('+0.0%');
  });
});

describe('formatFileSize', () => {
  it('steps through the byte units', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1_048_576)).toBe('5.0 MB');
    expect(formatFileSize(3 * 1_073_741_824)).toBe('3.0 GB');
  });
});
