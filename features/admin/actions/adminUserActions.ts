'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/auth/tenant-guard';
import { getInviteLoginRedirectUrl } from '@/lib/auth/invite-redirect';

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  role_id: string;
  tenant_id: string;
  created_at: string;
  tenant: { id: string; name: string; slug: string };
  roleMeta: { id: string; slug: string; description: string | null };
}

export interface AdminUserFilterTenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface AdminUserFilterRole {
  id: string;
  slug: string;
  description: string | null;
}

export interface AdminAssignableRole {
  id: string;
  slug: string;
}

export interface AdminUserFilters {
  tenantId?: string;
  search?: string;
  roleId?: string;
}

type UserListRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  role_id: string;
  tenant_id: string;
  created_at: string;
};

function sanitizeSearch(raw: string): string {
  return raw.replace(/[%_]/g, '').trim();
}

function logAdminServiceMissing(context: string, err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(
    `DEBUG USER FETCH ERROR: [${context}] SUPABASE_SERVICE_ROLE_KEY is missing or invalid — ` +
      'admin service client unavailable. Reads fall back to super_admin session client.',
    detail,
  );
}

/** Service role for auth.admin mutations; null when key is not configured. */
function getAdminServiceClient(): ReturnType<typeof createSupabaseAdminClient> | null {
  try {
    return createSupabaseAdminClient();
  } catch (err) {
    logAdminServiceMissing('getAdminServiceClient', err);
    return null;
  }
}

/** Prefer service role; fall back to authenticated super_admin session for reads. */
async function resolveAdminReadClient(context: string): Promise<SupabaseClient> {
  try {
    return createSupabaseAdminClient();
  } catch (err) {
    logAdminServiceMissing(context, err);
    return createSupabaseServerClient();
  }
}

async function listAssignableRolesForTenantAdmin(
  admin: SupabaseClient,
  tenantId: string,
): Promise<AdminAssignableRole[]> {
  const [{ data: base }, { data: custom }] = await Promise.all([
    admin.from('roles').select('id, slug').is('tenant_id', null).in('slug', ['tenant_admin', 'tenant_user']),
    admin.from('roles').select('id, slug').eq('tenant_id', tenantId),
  ]);

  const rows = [...(base ?? []), ...(custom ?? [])] as AdminAssignableRole[];
  const seen = new Set<string>();
  return rows.filter(
    (r) => r.slug !== 'super_admin' && (seen.has(r.id) ? false : (seen.add(r.id), true)),
  );
}

export async function fetchAdminUserFilterOptions(): Promise<{
  tenants: AdminUserFilterTenant[];
  roles: AdminUserFilterRole[];
}> {
  await requireAdminSession();

  try {
    const db = await resolveAdminReadClient('fetchAdminUserFilterOptions');

    const [tenantsRes, rolesRes] = await Promise.all([
      db.from('tenants').select('id, name, slug, is_active').order('name', { ascending: true }),
      db
        .from('roles')
        .select('id, slug, description')
        .is('tenant_id', null)
        .in('slug', ['super_admin', 'tenant_admin', 'tenant_user'])
        .order('slug', { ascending: true }),
    ]);

    if (tenantsRes.error) {
      console.error('DEBUG USER FETCH ERROR: [fetchAdminUserFilterOptions] tenants', tenantsRes.error);
    }
    if (rolesRes.error) {
      console.error('DEBUG USER FETCH ERROR: [fetchAdminUserFilterOptions] roles', rolesRes.error);
    }

    return {
      tenants: (tenantsRes.data ?? []) as AdminUserFilterTenant[],
      roles: (rolesRes.data ?? []) as AdminUserFilterRole[],
    };
  } catch (err) {
    console.error('DEBUG USER FETCH ERROR: [fetchAdminUserFilterOptions]', err);
    return { tenants: [], roles: [] };
  }
}

export async function fetchAdminAssignableRoles(tenantId: string): Promise<AdminAssignableRole[]> {
  await requireAdminSession();
  const admin = getAdminServiceClient();
  const db = admin ?? (await resolveAdminReadClient('fetchAdminAssignableRoles'));
  return listAssignableRolesForTenantAdmin(db, tenantId);
}

async function hydrateUserRows(
  db: SupabaseClient,
  rows: UserListRow[],
): Promise<AdminUserRow[]> {
  if (rows.length === 0) return [];

  const tenantIds = [...new Set(rows.map((r) => r.tenant_id).filter(Boolean))];
  const roleIds = [...new Set(rows.map((r) => r.role_id).filter(Boolean))];

  const [tenantsRes, rolesRes] = await Promise.all([
    tenantIds.length
      ? db.from('tenants').select('id, name, slug').in('id', tenantIds)
      : Promise.resolve({ data: [], error: null }),
    roleIds.length
      ? db.from('roles').select('id, slug, description').in('id', roleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tenantsRes.error) {
    console.error('DEBUG USER FETCH ERROR: [fetchAdminUsers] tenant lookup', tenantsRes.error);
  }
  if (rolesRes.error) {
    console.error('DEBUG USER FETCH ERROR: [fetchAdminUsers] role lookup', rolesRes.error);
  }

  const tenantMap = new Map(
    (tenantsRes.data ?? []).map((t) => [t.id as string, t as { id: string; name: string; slug: string }]),
  );
  const roleMap = new Map(
    (rolesRes.data ?? []).map((r) => [
      r.id as string,
      r as { id: string; slug: string; description: string | null },
    ]),
  );

  return rows.map((row) => {
    const tenant =
      tenantMap.get(row.tenant_id) ??
      ({
        id: row.tenant_id,
        name: 'Unknown tenant',
        slug: 'unknown',
      } as const);

    const roleMeta =
      roleMap.get(row.role_id) ??
      ({
        id: row.role_id,
        slug: row.role,
        description: null,
      } as const);

    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      role: row.role,
      role_id: row.role_id,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      tenant,
      roleMeta,
    };
  });
}

export async function fetchAdminUsers(filters?: AdminUserFilters): Promise<AdminUserRow[]> {
  await requireAdminSession();

  try {
    const db = await resolveAdminReadClient('fetchAdminUsers');

    let query = db
      .from('users')
      .select('id, email, full_name, avatar_url, role, role_id, tenant_id, created_at')
      .order('created_at', { ascending: false });

    if (filters?.tenantId) {
      query = query.eq('tenant_id', filters.tenantId);
    }

    if (filters?.roleId) {
      query = query.eq('role_id', filters.roleId);
    }

    const search = filters?.search ? sanitizeSearch(filters.search) : '';
    if (search.length >= 2) {
      const pattern = `%${search}%`;
      query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('DEBUG USER FETCH ERROR: [fetchAdminUsers]', error);
      return [];
    }

    return hydrateUserRows(db, (data ?? []) as UserListRow[]);
  } catch (err) {
    console.error('DEBUG USER FETCH ERROR: [fetchAdminUsers]', err);
    return [];
  }
}

export async function adminInviteNewUser(
  tenantId: string,
  email: string,
  roleId: string,
): Promise<{ success: boolean; error?: string; errorKey?: string }> {
  await requireAdminSession();

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return { success: false, errorKey: 'errInvalidEmail' };
  }

  const admin = getAdminServiceClient();
  if (!admin) {
    return { success: false, errorKey: 'errServiceUnavailable' };
  }

  const allowed = await listAssignableRolesForTenantAdmin(admin, tenantId);
  if (!allowed.some((r) => r.id === roleId)) {
    return { success: false, errorKey: 'errRoleNotAssignable' };
  }

  const redirect = await getInviteLoginRedirectUrl(admin, tenantId);
  if ('error' in redirect) {
    return { success: false, errorKey: redirect.error === 'TENANT_NOT_FOUND' ? 'errTenantNotFound' : 'errTenantLookup' };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(trimmed, {
    redirectTo: redirect.redirectTo,
    data: {
      tenant_id: tenantId,
      role_id: roleId,
      full_name: trimmed.split('@')[0],
    },
  });

  if (error) {
    console.error('[adminInviteNewUser]', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/users');
  return { success: true };
}

export async function adminUpdateUserRole(
  userId: string,
  targetRoleId: string,
): Promise<{ success: boolean; error?: string; errorKey?: string }> {
  await requireAdminSession();

  const admin = getAdminServiceClient();
  if (!admin) {
    return { success: false, errorKey: 'errServiceUnavailable' };
  }

  const { data: targetRole } = await admin.from('roles').select('slug').eq('id', targetRoleId).maybeSingle();
  if (!targetRole?.slug || targetRole.slug === 'super_admin') {
    return { success: false, errorKey: 'errSuperAdminBlocked' };
  }

  const { data: userRow, error: userErr } = await admin
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', userId)
    .maybeSingle();

  if (userErr || !userRow) {
    return { success: false, errorKey: 'errUserNotFound' };
  }

  if (userRow.role === 'super_admin') {
    return { success: false, errorKey: 'errSuperAdminBlocked' };
  }

  const tenantId = userRow.tenant_id as string;
  const allowed = await listAssignableRolesForTenantAdmin(admin, tenantId);
  if (!allowed.some((r) => r.id === targetRoleId)) {
    return { success: false, errorKey: 'errRoleNotAssignable' };
  }

  if (userRow.role === 'tenant_admin') {
    const { data: admins } = await admin
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'tenant_admin');

    if ((admins?.length ?? 0) <= 1 && admins?.[0]?.id === userId && targetRole.slug !== 'tenant_admin') {
      return { success: false, errorKey: 'errLastTenantAdmin' };
    }
  }

  const { error } = await admin.from('users').update({ role_id: targetRoleId }).eq('id', userId);

  if (error) {
    console.error('[adminUpdateUserRole]', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/users');
  return { success: true };
}

export async function adminRevokeUser(
  userId: string,
): Promise<{ success: boolean; error?: string; errorKey?: string }> {
  await requireAdminSession();

  const admin = getAdminServiceClient();
  if (!admin) {
    return { success: false, errorKey: 'errServiceUnavailable' };
  }

  const { data: row } = await admin.from('users').select('role, tenant_id').eq('id', userId).maybeSingle();

  if (!row) {
    return { success: false, errorKey: 'errUserNotFound' };
  }

  if (row.role === 'super_admin') {
    return { success: false, errorKey: 'errSuperAdminBlocked' };
  }

  if (row.role === 'tenant_admin') {
    const { data: admins } = await admin
      .from('users')
      .select('id')
      .eq('tenant_id', row.tenant_id as string)
      .eq('role', 'tenant_admin');

    if ((admins?.length ?? 0) <= 1) {
      return { success: false, errorKey: 'errLastTenantAdmin' };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[adminRevokeUser]', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/users');
  return { success: true };
}
