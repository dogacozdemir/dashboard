import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchCapabilitiesForUser } from '@/lib/auth/capabilities';
import type { SessionUser, UserLocale } from '@/types/user';

export const CAPABILITIES_JWT_SYNC_MS = 5 * 60_000;

export interface PermissionCacheEntry {
  role: SessionUser['role'];
  tenantId: string;
  tenantSlug: string;
  locale: UserLocale;
  capabilities: SessionUser['capabilities'];
  syncedAt: number;
}

const permissionCache = new Map<string, PermissionCacheEntry>();
const inFlightSync = new Map<string, Promise<PermissionCacheEntry | null>>();

function normalizeLocale(raw: unknown): UserLocale {
  return raw === 'en' ? 'en' : 'tr';
}

export function getPermissionCacheEntry(uid: string): PermissionCacheEntry | undefined {
  return permissionCache.get(uid);
}

/** Blocking refresh — used at login and when JWT has no capability payload yet. */
export async function refreshPermissionCacheBlocking(uid: string): Promise<PermissionCacheEntry | null> {
  const existing = inFlightSync.get(uid);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const admin = createSupabaseAdminClient();
      const { data: profile } = await admin
        .from('users')
        .select('role, role_id, tenant_id, locale')
        .eq('id', uid)
        .maybeSingle();

      if (!profile?.role_id || !profile.tenant_id) return null;

      const capabilities = await fetchCapabilitiesForUser(
        admin,
        profile.role_id as string,
        profile.tenant_id as string,
      );

      const { data: tenant } = await admin
        .from('tenants')
        .select('slug')
        .eq('id', profile.tenant_id as string)
        .maybeSingle();

      const entry: PermissionCacheEntry = {
        role: profile.role as SessionUser['role'],
        tenantId: profile.tenant_id as string,
        tenantSlug: (tenant?.slug as string | undefined) ?? '',
        locale: normalizeLocale((profile as { locale?: string | null }).locale),
        capabilities,
        syncedAt: Date.now(),
      };

      permissionCache.set(uid, entry);
      return entry;
    } catch (e) {
      console.error('[permission-cache] blocking refresh failed', e);
      return null;
    } finally {
      inFlightSync.delete(uid);
    }
  })();

  inFlightSync.set(uid, promise);
  return promise;
}

/** Stale-while-revalidate — never blocks the hot path when JWT already has role/capabilities. */
export function schedulePermissionCacheRefresh(uid: string): void {
  if (inFlightSync.has(uid)) return;

  const promise = refreshPermissionCacheBlocking(uid).finally(() => {
    inFlightSync.delete(uid);
  });
  inFlightSync.set(uid, promise);
}

export function applyPermissionEntryToToken(
  token: Record<string, unknown>,
  entry: PermissionCacheEntry,
): void {
  token.role = entry.role;
  token.tenantId = entry.tenantId;
  token.tenantSlug = entry.tenantSlug;
  token.locale = entry.locale;
  token.capabilities = entry.capabilities;
  token.permsSyncedAt = entry.syncedAt;
}
