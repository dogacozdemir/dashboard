import { headers } from 'next/headers';
import { parseTenantSlugFromHost } from '@/lib/utils/parse-tenant-host';

/** Tenant slug from middleware header, falling back to Host parsing. */
export async function resolveRequestTenantSlug(): Promise<string> {
  const headersList = await headers();
  const fromMiddleware = (headersList.get('x-tenant-slug') ?? '').trim();
  if (fromMiddleware) return fromMiddleware;

  const host = headersList.get('host') ?? headersList.get('x-forwarded-host') ?? '';
  return parseTenantSlugFromHost(host);
}
