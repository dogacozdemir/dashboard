/** Cross-request slug → tenant UUID cache (shared by proxy and RSC). */
const ID_CACHE_TTL_MS = 5 * 60_000;

interface IdCacheEntry {
  id: string;
  expiresAt: number;
}

const idBySlug = new Map<string, IdCacheEntry>();
const inFlightIdLookup = new Map<string, Promise<string | null>>();

export function getCachedTenantId(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  const hit = idBySlug.get(normalized);
  if (hit && hit.expiresAt > Date.now()) return hit.id;
  return null;
}

export function seedTenantIdCache(slug: string, id: string): void {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || !id) return;
  idBySlug.set(normalized, { id, expiresAt: Date.now() + ID_CACHE_TTL_MS });
}

export function rememberInFlightIdLookup(slug: string, promise: Promise<string | null>): Promise<string | null> {
  const normalized = slug.trim().toLowerCase();
  const existing = inFlightIdLookup.get(normalized);
  if (existing) return existing;

  const tracked = promise.finally(() => {
    inFlightIdLookup.delete(normalized);
  });
  inFlightIdLookup.set(normalized, tracked);
  return tracked;
}
