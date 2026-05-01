import type { DefaultSession } from 'next-auth';
import type { PermissionSlug, UserRole, UserLocale } from '@/types/user';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: UserRole;
      tenantId: string;
      tenantSlug: string;
      capabilities: PermissionSlug[];
      locale: UserLocale;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    tenantId?: string;
    tenantSlug?: string;
    capabilities?: PermissionSlug[];
    locale?: UserLocale;
    /** Unix ms — last DB sync of role/capabilities (see lib/auth/config jwt callback). */
    permsSyncedAt?: number;
  }
}
