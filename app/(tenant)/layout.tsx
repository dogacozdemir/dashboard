import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/config';
import { getTenantBySlug, createSupabaseServerClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { TenantProvider } from '@/hooks/useTenant';
import { fetchUserGamification } from '@/features/gamification/actions/fetchGamification';
import { ActivityTracker } from '@/features/gamification/components/ActivityTracker';
import type { SessionUser } from '@/types/user';

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const headersList = await headers();
  const headerTenantSlug = headersList.get('x-tenant-slug') ?? '';
  const user = session.user as SessionUser;

  const tenantSlug =
    headerTenantSlug === 'localhost' || headerTenantSlug === '127.0.0.1'
      ? (user.tenantSlug ?? '')
      : headerTenantSlug;

  const tenantRaw = await getTenantBySlug(tenantSlug);
  if (!tenantRaw) redirect('/not-found');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = tenantRaw as any;

  if (user.role !== 'admin' && user.tenantSlug && user.tenantSlug !== tenantSlug) {
    redirect('/unauthorized');
  }

  // Fetch gamification data (non-blocking — returns null on error)
  const gamification = await fetchUserGamification();

  // Pre-fetch recent unread notifications for the bell
  const supabase = await createSupabaseServerClient();
  const { data: notifRows } = await supabase
    .from('notifications')
    .select('id, message, type, sender_name, is_read, created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const initialNotifs = (notifRows ?? []).map((n) => ({
    id:         n.id,
    message:    n.message,
    type:       n.type as 'message' | 'alert' | 'approval' | 'system',
    senderName: n.sender_name,
    isRead:     n.is_read,
    createdAt:  n.created_at,
  }));

  return (
    <TenantProvider value={{ tenant, companyId: tenant.id }}>
      <ActivityTracker />
      <DashboardShell
        tenant={tenant}
        user={user}
        title={tenant.name}
        subtitle="Frictionless Marketing Operations"
        initialNotifs={initialNotifs}
        gamification={gamification}
      >
        {children}
      </DashboardShell>
    </TenantProvider>
  );
}
