'use client';

import type { UserRole } from '@/types/user';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  client: 2,
  viewer: 1,
};

export function usePermission(userRole: UserRole) {
  function can(action: 'view' | 'edit' | 'admin'): boolean {
    const required: Record<typeof action, UserRole> = {
      view: 'viewer',
      edit: 'client',
      admin: 'admin',
    };
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required[action]];
  }

  return { can };
}
