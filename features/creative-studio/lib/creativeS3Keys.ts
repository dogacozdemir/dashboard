/**
 * Parse stored creative_assets.url / thumbnail_url into S3 object keys.
 * Matches logic used when signing downloads in fetchCreativeAssets.
 */
export function extractS3Key(value: string): string {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    } catch {
      return value;
    }
  }
  return value;
}

export function normalizeDuplicateTenantKey(key: string): string {
  const parts = key.split('/');
  if (
    parts.length >= 4 &&
    (parts[1] === 'creative' || parts[1] === 'brand') &&
    parts[0] === parts[2]
  ) {
    return [parts[0], parts[1], ...parts.slice(3)].join('/');
  }
  return key;
}

/** Keys under this tenant prefix that are safe to delete from the creative bucket. */
export function getCreativeKeysToPurge(
  url: string | null | undefined,
  thumbnailUrl: string | null | undefined,
  tenantId: string,
): string[] {
  const prefix = `${tenantId}/`;
  const out: string[] = [];
  for (const raw of [url, thumbnailUrl]) {
    if (!raw?.trim()) continue;
    const k = normalizeDuplicateTenantKey(extractS3Key(raw));
    if (k && k.startsWith(prefix)) out.push(k);
  }
  return [...new Set(out)];
}
