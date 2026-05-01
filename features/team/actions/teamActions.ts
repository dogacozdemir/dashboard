'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertPermission } from '@/lib/auth/permissions';
import { requireTenantAction } from '@/lib/auth/tenant-guard';

export interface TeamMemberRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  role_id: string;
  created_at: string;
}

export interface AssignableRole {
  id: string;
  slug: string;
}

export async function listAssignableRolesForTenant(companyId: string): Promise<AssignableRole[]> {
  const cid = await requireTenantAction(companyId);
  await assertPermission('management.users');

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return [];
  }

  const [{ data: base }, { data: custom }] = await Promise.all([
    admin.from('roles').select('id, slug').is('tenant_id', null).in('slug', ['tenant_admin', 'tenant_user']),
    admin.from('roles').select('id, slug').eq('tenant_id', cid),
  ]);

  const rows = [...(base ?? []), ...(custom ?? [])] as AssignableRole[];
  const seen = new Set<string>();
  return rows.filter(
    (r) => r.slug !== 'super_admin' && (seen.has(r.id) ? false : (seen.add(r.id), true))
  );
}

export async function listTeamMembers(companyId: string): Promise<TeamMemberRow[]> {
  const cid = await requireTenantAction(companyId);
  await assertPermission('management.users');

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return [];
  }

  const { data, error } = await admin
    .from('users')
    .select('id, email, full_name, role, role_id, created_at')
    .eq('tenant_id', cid)
    .order('created_at', { ascending: true });

  if (error || !data) {
    console.error('[listTeamMembers]', error?.message);
    return [];
  }

  return data.map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    role: r.role as string,
    role_id: r.role_id as string,
    created_at: r.created_at,
  }));
}

export async function inviteTeamMember(
  companyId: string,
  email: string,
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  const cid = await requireTenantAction(companyId);
  await assertPermission('management.users');

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return { success: false, error: 'Geçerli bir e-posta girin.' };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { success: false, error: 'Davet şu an gönderilemiyor.' };
  }

  const allowed = await listAssignableRolesForTenant(cid);
  if (!allowed.some((r) => r.id === roleId)) {
    return { success: false, error: 'Bu rol bu tenant için atanamaz.' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const { error } = await admin.auth.admin.inviteUserByEmail(trimmed, {
    redirectTo: `${siteUrl.replace(/\/$/, '')}/login`,
    data: {
      tenant_id: cid,
      role_id: roleId,
      full_name: trimmed.split('@')[0],
    },
  });

  if (error) {
    console.error('[inviteTeamMember]', error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updateTeamMemberRole(
  companyId: string,
  userId: string,
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  const cid = await requireTenantAction(companyId);
  await assertPermission('management.users');

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { success: false, error: 'İşlem yapılamadı.' };
  }

  const allowed = await listAssignableRolesForTenant(cid);
  if (!allowed.some((r) => r.id === roleId)) {
    return { success: false, error: 'Bu rol bu tenant için atanamaz.' };
  }

  const { data: admins, error: countErr } = await admin
    .from('users')
    .select('id, role')
    .eq('tenant_id', cid)
    .eq('role', 'tenant_admin');

  if (countErr) return { success: false, error: countErr.message };

  const adminRows = admins ?? [];
  if (
    adminRows.length <= 1 &&
    adminRows[0]?.id === userId
  ) {
    const { data: targetRole } = await admin.from('roles').select('slug').eq('id', roleId).maybeSingle();
    if (targetRole?.slug !== 'tenant_admin') {
      return { success: false, error: 'Son tenant yöneticisinin rolü düşürülemez.' };
    }
  }

  const { error } = await admin.from('users').update({ role_id: roleId }).eq('id', userId).eq('tenant_id', cid);

  if (error) {
    console.error('[updateTeamMemberRole]', error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function revokeTeamMember(
  companyId: string,
  userId: string,
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  const cid = await requireTenantAction(companyId);
  await assertPermission('management.users');

  if (userId === currentUserId) {
    return { success: false, error: 'Kendi erişiminizi bu ekrandan kaldıramazsınız.' };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { success: false, error: 'İşlem yapılamadı.' };
  }

  const { data: row } = await admin.from('users').select('role').eq('id', userId).eq('tenant_id', cid).maybeSingle();

  if (!row) return { success: false, error: 'Kullanıcı bulunamadı.' };

  if (row.role === 'tenant_admin') {
    const { data: admins } = await admin
      .from('users')
      .select('id')
      .eq('tenant_id', cid)
      .eq('role', 'tenant_admin');
    if ((admins?.length ?? 0) <= 1) {
      return { success: false, error: 'Son tenant yöneticisi silinemez.' };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[revokeTeamMember]', error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
