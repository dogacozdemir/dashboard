/** Product default — the platform is Turkish-first. */
export const DEFAULT_CURRENCY = 'TRY';

/** Locale used for grouping/decimal separators per currency. */
function localeForCurrency(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'USD':
      return 'en-US';
    case 'EUR':
      return 'de-DE';
    case 'GBP':
      return 'en-GB';
    default:
      return 'tr-TR';
  }
}

/**
 * Formats money using the tenant's own currency. Previously this hardcoded USD +
 * en-US, so Turkish workspaces saw "$1,234" for ₺ amounts.
 */
export function formatCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY,
  maximumFractionDigits = 0,
): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  try {
    return new Intl.NumberFormat(localeForCurrency(code), {
      style: 'currency',
      currency: code,
      maximumFractionDigits,
    }).format(value);
  } catch {
    // Unknown/invalid ISO code — fall back to a plain grouped number.
    return `${value.toLocaleString('tr-TR', { maximumFractionDigits })} ${code}`;
  }
}

/** Just the symbol (e.g. "₺", "$") — for compact metric-card prefixes. */
export function currencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  try {
    const parts = new Intl.NumberFormat(localeForCurrency(code), {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}
