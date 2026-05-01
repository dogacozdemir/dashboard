/** Slug from public.roles (system roles + custom roles). */
export type UserRole = string;

/** Slugs aligned with public.permissions.slug (see RBAC migration). */
export type PermissionSlug =
  | 'creative.upload'
  | 'creative.approve'
  | 'creative.comment'
  | 'brand.upload'
  | 'integrations.manage'
  | 'strategy.geo_run'
  | 'strategy.insight_write'
  | 'calendar.create'
  | 'chat.send'
  | 'notifications.view'
  | 'ai.mono_chat'
  | 'management.users';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  tenant_id: string;
  created_at: string;
}

export type UserLocale = 'tr' | 'en';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantSlug: string;
  /** Effective permission slugs for this session (from role_permissions). */
  capabilities: PermissionSlug[];
  name: string | null;
  image: string | null;
  /** Dashboard language preference (synced from users.locale). */
  locale: UserLocale;
}
