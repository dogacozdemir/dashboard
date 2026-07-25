/**
 * Validation + normalisation for competitor URLs. Kept pure (no server-only,
 * no DB) so it can be unit-tested and shared between the client form and the
 * server action.
 */

export interface NormalizedCompetitorUrl {
  /** Canonical URL we store and fetch (always has a scheme). */
  url: string;
  /** Bare hostname for display and de-duplication. */
  host: string;
}

/** Rejects anything that isn't a plain public http(s) page. */
export function normalizeCompetitorUrl(raw: string): NormalizedCompetitorUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  // Must look like a real domain (has a dot, no spaces).
  if (!host.includes('.') || /\s/.test(host)) return null;

  // Never allow pointing the crawler at internal hosts.
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  ) {
    return null;
  }

  // Drop fragments and tracking noise but keep the meaningful path + query.
  parsed.hash = '';
  return { url: parsed.toString(), host };
}

/** A short display label for a competitor when no name was given. */
export function deriveCompetitorName(host: string): string {
  const label = host.split('.')[0] ?? host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
