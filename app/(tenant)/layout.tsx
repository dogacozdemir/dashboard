import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/config';
import { IMPERSONATE_TENANT_COOKIE } from '@/lib/auth/constants';
import { getTenantBySlug, createSupabaseServerClient } from '@/lib/supabase/server';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { getAdminTenantsUrl } from '@/lib/utils/tenant-urls';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { TenantProvider } from '@/hooks/useTenant';
import { fetchUserGamification } from '@/features/gamification/actions/fetchGamification';
import { ActivityTracker } from '@/features/gamification/components/ActivityTracker';
import { MagicTour } from '@/features/onboarding/components/MagicTour';
import type { SessionUser } from '@/types/user';
import { mapRowToLuxNotification } from '@/features/notifications/lib/mapNotificationRow';
import type { LuxNotificationItem } from '@/features/notifications/types';
import { resolveEffectiveLocale } from '@/lib/i18n/resolve-effective-locale';
import { loadMessages } from '@/lib/i18n/load-messages';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const slug = headersList.get('x-tenant-slug') ?? '';
  const raw = slug ? await getTenantBySlug(slug) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name: string = raw ? (raw as any).name ?? slug : slug;
  return {
    title: name
      ? { template: `%s — ${name}`, default: `${name} — Madmonos` }
      : { template: '%s — Madmonos', default: 'Madmonos Dashboard' },
  };
}

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
  if (!tenantRaw) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = tenantRaw as any;

  if (user.role !== 'super_admin' && user.tenantSlug && user.tenantSlug !== tenantSlug) {
    redirect('/unauthorized');
  }

  // Fetch gamification data (non-blocking — returns null on error)
  const gamification = await fetchUserGamification();

  const canUseNotifications =
    sessionHasPermission(user, 'notifications.view') || sessionHasPermission(user, 'chat.send');

  const supabase = await createSupabaseServerClient();
  let initialNotifs: LuxNotificationItem[] = [];
  if (canUseNotifications) {
    const { data: notifRows } = await supabase
      .from('notifications')
      .select('id, message, type, sender_name, is_read, created_at, category, action_url, action_label')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(30);

    initialNotifs = (notifRows ?? []).map((n) =>
      mapRowToLuxNotification({
        id: n.id,
        message: n.message,
        type: n.type,
        sender_name: n.sender_name,
        is_read: n.is_read,
        created_at: n.created_at,
        category: (n as { category?: string | null }).category,
        action_url: (n as { action_url?: string | null }).action_url,
        action_label: (n as { action_label?: string | null }).action_label,
      })
    );
  }

  const cookieStore = await cookies();
  const impSlug = cookieStore.get(IMPERSONATE_TENANT_COOKIE)?.value?.trim() ?? '';
  const isImpersonating =
    user.role === 'super_admin' && impSlug.length > 0 && impSlug === tenant.slug;

  const impersonation = isImpersonating
    ? { tenantName: String(tenant.name), exitHref: getAdminTenantsUrl() }
    : null;

  const canManageTeam = sessionHasPermission(user, 'management.users');

  const locale = await resolveEffectiveLocale(user.locale);
  setRequestLocale(locale);
  const messages = loadMessages(locale);
  const tDash = await getTranslations({ locale, namespace: 'Dashboard' });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TenantProvider value={{ tenant, companyId: tenant.id }}>
        <ActivityTracker />
        <MagicTour autoShow />
        <DashboardShell
          tenant={tenant}
          user={user}
          title={tenant.name}
          subtitle={tDash('shell.subtitle')}
          initialNotifs={initialNotifs}
          gamification={gamification}
          impersonation={impersonation}
          showroomMode={Boolean(tenant.is_demo)}
          canManageTeam={canManageTeam}
          canUseNotifications={canUseNotifications}
        >
          {children}
        </DashboardShell>
      </TenantProvider>
    </NextIntlClientProvider>
  );
}
