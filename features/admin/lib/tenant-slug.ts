export const TENANT_SLUG_RE = /^[a-z][a-z0-9-]{1,62}$/;

export const RESERVED_TENANT_SLUGS = new Set(['admin', 'www', 'app', 'api', 'localhost']);

export function normalizeTenantSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Returns an i18n error key suffix under Admin.tenantTable.create, or null if valid. */
export function tenantSlugIssue(slug: string): 'required' | 'invalid' | 'reserved' | null {
  if (!slug) return 'required';
  if (!TENANT_SLUG_RE.test(slug)) return 'invalid';
  if (RESERVED_TENANT_SLUGS.has(slug)) return 'reserved';
  return null;
}
