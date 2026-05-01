'use client';

import type { UserRole } from '@/types/user';

const ROLE_LEVEL: Record<string, number> = {
  super_admin: 3,
  tenant_admin: 2,
  tenant_user: 1,
};

function roleTier(slug: string): number {
  return ROLE_LEVEL[slug] ?? 1;
}

export function usePermission(userRole: UserRole) {
  function can(action: 'view' | 'edit' | 'admin'): boolean {
    const required: Record<typeof action, string> = {
      view: 'tenant_user',
      edit: 'tenant_admin',
      admin: 'super_admin',
    };
    return roleTier(userRole) >= roleTier(required[action]);
  }

  return { can };
}
