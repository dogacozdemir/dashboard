import type { PermissionSlug, SessionUser } from '@/types/user';

function normalizedRoleSlug(role: unknown): string {
  return String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function sessionHasPermission(user: SessionUser | undefined, slug: PermissionSlug): boolean {
  if (!user) return false;
  const r = normalizedRoleSlug(user.role);
  if (r === 'super_admin') return true;
  return (user.capabilities ?? []).includes(slug);
}
