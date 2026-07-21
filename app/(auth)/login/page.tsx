import { Suspense } from 'react';
import { headers } from 'next/headers';
import { parseTenantSlugFromHost } from '@/lib/utils/parse-tenant-host';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const headersList = await headers();
  const hostTenantSlug = parseTenantSlugFromHost(headersList.get('host') ?? '');

  return (
    <Suspense fallback={null}>
      <LoginForm hostTenantSlug={hostTenantSlug} />
    </Suspense>
  );
}
