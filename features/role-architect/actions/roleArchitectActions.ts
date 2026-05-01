'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/auth/tenant-guard';

export interface RoleRow {
  id: string;
  slug: string;
  description: string | null;
  sort_order: number;
  tenant_id: string | null;
}

export interface PermissionRow {
  id: string;
  slug: string;
  description: string | null;
}

export interface TenantMini {
  id: string;
  name: string;
  slug: string;
}

const SLUG_RE = /^[a-z][a-z0-9_]{1,62}$/;
const CORE_SLUGS = new Set(['super_admin', 'tenant_admin', 'tenant_user']);

async function supa() {
  await requireAdminSession();
  return createSupabaseServerClient();
}

export async function fetchRoleArchitectBootstrap(): Promise<{
  roles: RoleRow[];
  permissions: PermissionRow[];
  tenants: TenantMini[];
}> {
  await requireAdminSession();
  const db = await createSupabaseServerClient();

  const [{ data: roles }, { data: permissions }, { data: tenants }] = await Promise.all([
    db.from('roles').select('id, slug, description, sort_order, tenant_id').order('sort_order', { ascending: true }),
    db.from('permissions').select('id, slug, description').order('slug', { ascending: true }),
    db.from('tenants').select('id, name, slug').order('name', { ascending: true }),
  ]);

  return {
    roles: (roles ?? []) as RoleRow[],
    permissions: (permissions ?? []) as PermissionRow[],
    tenants: (tenants ?? []) as TenantMini[],
  };
}

export async function fetchRolePermissionIds(roleId: string): Promise<Set<string>> {
  const db = await supa();
  const { data, error } = await db.from('role_permissions').select('permission_id').eq('role_id', roleId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.permission_id as string));
}

export async function fetchDenialIds(tenantId: string, roleId: string): Promise<Set<string>> {
  const db = await supa();
  const { data, error } = await db
    .from('tenant_role_permission_denials')
    .select('permission_id')
    .eq('tenant_id', tenantId)
    .eq('role_id', roleId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.permission_id as string));
}

export async function createRole(input: {
  slug: string;
  description?: string;
  tenantId?: string | null;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const db = await supa();
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { success: false, error: 'Slug: küçük harf, rakam ve alt çizgi; 2–63 karakter.' };
  }
  if (CORE_SLUGS.has(slug) && input.tenantId) {
    return { success: false, error: 'Çekirdek rol slug’ları tenant özel rol için kullanılamaz.' };
  }

  const { data: maxRow } = input.tenantId
    ? await db
        .from('roles')
        .select('sort_order')
        .eq('tenant_id', input.tenantId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
    : await db
        .from('roles')
        .select('sort_order')
        .is('tenant_id', null)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await db
    .from('roles')
    .insert({
      slug,
      description: input.description?.trim() || null,
      tenant_id: input.tenantId ?? null,
      sort_order: nextOrder,
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

export async function deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
  const db = await supa();
  const { data: role } = await db.from('roles').select('slug').eq('id', roleId).maybeSingle();
  if (!role) return { success: false, error: 'Rol bulunamadı.' };
  if (role.slug === 'super_admin') return { success: false, error: 'super_admin silinemez.' };
  if (CORE_SLUGS.has(role.slug)) {
    return { success: false, error: 'Çekirdek roller (tenant_admin / tenant_user) silinemez.' };
  }

  const { count } = await db.from('users').select('id', { count: 'exact', head: true }).eq('role_id', roleId);
  if ((count ?? 0) > 0) {
    return { success: false, error: 'Bu role atanmış kullanıcılar var.' };
  }

  const { error } = await db.from('roles').delete().eq('id', roleId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function reorderRoles(
  orderedRoleIds: string[],
  tenantId: string | null
): Promise<{ success: boolean; error?: string }> {
  const db = await supa();
  for (let i = 0; i < orderedRoleIds.length; i++) {
    const id = orderedRoleIds[i];
    const { data: row } = await db.from('roles').select('tenant_id').eq('id', id).maybeSingle();
    if (!row) continue;
    const rowTid = row.tenant_id as string | null;
    if (tenantId === null && rowTid !== null) continue;
    if (tenantId !== null && rowTid !== tenantId) continue;
    const { error } = await db.from('roles').update({ sort_order: i }).eq('id', id);
    if (error) return { success: false, error: error.message };
  }
  return { success: true };
}

async function guardTenantAdminManagementUsers(
  db: SupabaseClient,
  roleId: string,
  permissionId: string,
  granting: boolean
): Promise<string | null> {
  if (granting) return null;
  const { data: role } = await db.from('roles').select('slug').eq('id', roleId).maybeSingle();
  const { data: perm } = await db.from('permissions').select('slug').eq('id', permissionId).maybeSingle();
  if (role?.slug === 'tenant_admin' && perm?.slug === 'management.users') {
    return 'tenant_admin için management.users kaldırılamaz.';
  }
  return null;
}

export async function setRolePermission(
  roleId: string,
  permissionId: string,
  granted: boolean
): Promise<{ success: boolean; error?: string }> {
  const db = await supa();
  const { data: role } = await db.from('roles').select('slug').eq('id', roleId).maybeSingle();
  if (!role) return { success: false, error: 'Rol yok.' };
  if (role.slug === 'super_admin') {
    return { success: false, error: 'super_admin izinleri değiştirilemez (tam yetki).' };
  }

  const guardMsg = await guardTenantAdminManagementUsers(db, roleId, permissionId, granted);
  if (guardMsg) return { success: false, error: guardMsg };

  if (granted) {
    const { error } = await db.from('role_permissions').upsert(
      { role_id: roleId, permission_id: permissionId },
      { onConflict: 'role_id,permission_id' }
    );
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  const { error } = await db.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function setTenantDenial(
  tenantId: string,
  roleId: string,
  permissionId: string,
  denied: boolean
): Promise<{ success: boolean; error?: string }> {
  const db = await supa();
  const { data: role } = await db.from('roles').select('slug').eq('id', roleId).maybeSingle();
  if (role?.slug === 'super_admin') {
    return { success: false, error: 'super_admin için tenant override uygulanamaz.' };
  }

  const { data: perm } = await db.from('permissions').select('slug').eq('id', permissionId).maybeSingle();
  if (role?.slug === 'tenant_admin' && perm?.slug === 'management.users' && denied) {
    return { success: false, error: 'tenant_admin için management.users reddedilemez (kilitlenme koruması).' };
  }

  if (denied) {
    const { error } = await db
      .from('tenant_role_permission_denials')
      .upsert({ tenant_id: tenantId, role_id: roleId, permission_id: permissionId }, {
        onConflict: 'tenant_id,role_id,permission_id',
      });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  const { error } = await db
    .from('tenant_role_permission_denials')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('role_id', roleId)
    .eq('permission_id', permissionId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
