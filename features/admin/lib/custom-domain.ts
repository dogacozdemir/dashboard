/** Hostname only — no scheme, port, or path. */
export const CUSTOM_DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeCustomDomainInput(raw: string): string {
  let v = raw.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, '');
  v = v.split('/')[0] ?? '';
  v = v.split(':')[0] ?? '';
  return v;
}

export function customDomainIssue(domain: string): 'invalid' | null {
  if (!domain) return null;
  if (!CUSTOM_DOMAIN_RE.test(domain)) return 'invalid';
  return null;
}
