import type { SupabaseClient } from '@supabase/supabase-js';
import type { PermissionSlug } from '@/types/user';

/** JWT / session: full permission set for this user (global role_permissions minus tenant denials). */
export async function fetchCapabilitiesForUser(
  supabase: SupabaseClient,
  roleId: string,
  tenantId: string
): Promise<PermissionSlug[]> {
  const { data: roleRow, error: rErr } = await supabase
    .from('roles')
    .select('slug')
    .eq('id', roleId)
    .maybeSingle();

  if (rErr || !roleRow?.slug) return [];

  if (roleRow.slug === 'super_admin') {
    const { data, error } = await supabase.from('permissions').select('slug');
    if (error || !data?.length) return [];
    return data.map((r) => r.slug as PermissionSlug);
  }

  const { data: links, error: lErr } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId);

  if (lErr || !links?.length) return [];

  const permIds = [...new Set(links.map((l) => l.permission_id))];

  const { data: denRows } = await supabase
    .from('tenant_role_permission_denials')
    .select('permission_id')
    .eq('tenant_id', tenantId)
    .eq('role_id', roleId);

  const denied = new Set((denRows ?? []).map((d) => d.permission_id));
  const allowedIds = permIds.filter((id) => !denied.has(id));

  if (!allowedIds.length) return [];

  const { data: perms, error: pErr } = await supabase
    .from('permissions')
    .select('slug')
    .in('id', allowedIds);

  if (pErr || !perms?.length) return [];
  return perms.map((p) => p.slug as PermissionSlug);
}
