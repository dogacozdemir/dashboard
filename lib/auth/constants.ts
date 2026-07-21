/** HttpOnly cookie: target tenant slug when super_admin views a tenant as that customer. */
export const IMPERSONATE_TENANT_COOKIE = 'madmonos_impersonate_slug';
/** Paired tenant UUID — avoids slug→id lookup on every request when impersonating. */
export const IMPERSONATE_TENANT_ID_COOKIE = 'madmonos_impersonate_tenant_id';
