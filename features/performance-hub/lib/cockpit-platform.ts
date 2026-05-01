/** Unified Cockpit URL segment (?platform=) — filters analytics scope. */
export type CockpitPlatform = 'all' | 'meta' | 'google' | 'tiktok' | 'seo';

const VALID = new Set<CockpitPlatform>(['all', 'meta', 'google', 'tiktok', 'seo']);

export function parseCockpitPlatform(raw: string | undefined): CockpitPlatform {
  if (raw && VALID.has(raw as CockpitPlatform)) return raw as CockpitPlatform;
  return 'all';
}

/** DB `daily_metrics.platform` values for Supabase `.in()` — `null` = no filter (all rows). */
export function dailyMetricPlatformsFilter(
  cockpit: CockpitPlatform,
): Array<'meta' | 'google' | 'tiktok' | 'organic'> | null {
  if (cockpit === 'all') return null;
  if (cockpit === 'seo') return ['organic'];
  return [cockpit];
}

export function isPaidCockpitView(cockpit: CockpitPlatform): boolean {
  return cockpit === 'all' || cockpit === 'meta' || cockpit === 'google' || cockpit === 'tiktok';
}

export function cockpitShowsExecutiveTrend(cockpit: CockpitPlatform): boolean {
  return isPaidCockpitView(cockpit);
}
