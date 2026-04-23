export type UserRole = 'admin' | 'client' | 'viewer';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  tenant_id: string;
  created_at: string;
}

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantSlug: string;
  name: string | null;
  image: string | null;
}
