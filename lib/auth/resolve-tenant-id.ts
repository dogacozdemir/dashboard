import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  getCachedTenantId,
  rememberInFlightIdLookup,
  seedTenantIdCache,
} from '@/lib/auth/tenant-cache';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { id: string; expiresAt: number }>();

async function lookupTenantId(slug: string): Promise<string | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || normalized === 'admin' || normalized === 'www') {
    return null;
  }

  const crossFrameHit = getCachedTenantId(normalized);
  if (crossFrameHit) return crossFrameHit;

  const hit = cache.get(normalized);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.id;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', normalized)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data?.id) {
      return null;
    }

    const id = data.id as string;
    cache.set(normalized, { id, expiresAt: Date.now() + CACHE_TTL_MS });
    seedTenantIdCache(normalized, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Resolve active tenant UUID from slug (service role, cached + in-flight deduped).
 * Used in proxy so x-company-id matches subdomain / impersonation — not the viewer's home tenant.
 */
export async function resolveTenantIdBySlug(slug: string): Promise<string | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || normalized === 'admin' || normalized === 'www') {
    return null;
  }

  const instant = getCachedTenantId(normalized);
  if (instant) return instant;

  const hit = cache.get(normalized);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.id;
  }

  return rememberInFlightIdLookup(normalized, lookupTenantId(normalized));
}
