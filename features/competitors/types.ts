export interface DetectedPriceView {
  amount: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  /** Product/plan the price belongs to, when the page named one. */
  label?: string;
}

export interface CompetitorSnapshotSummary {
  changed: boolean;
  changeSummary: string | null;
  fetchedAt: string;
}

export interface Competitor {
  id: string;
  name: string;
  url: string;
  host: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  /** Most recent snapshot, if the competitor has been checked at least once. */
  latest: CompetitorSnapshotSummary | null;
  /** How many recorded changes this competitor has (excludes the baseline). */
  changeCount: number;
  /** Prices detected on the most recent check (sorted ascending). */
  prices: DetectedPriceView[];
  /** Human-readable price move on the latest change, e.g. "₺249 → ₺299 ↑". */
  priceChange: string | null;
  /** Recent recorded changes, newest first (baseline excluded). */
  history: Array<{ fetchedAt: string; changeSummary: string | null }>;
}
