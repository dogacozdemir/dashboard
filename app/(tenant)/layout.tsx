import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { getCachedSession } from '@/lib/auth/cached-auth';
import { getTenantContext } from '@/lib/auth/tenant-guard';
import { IMPERSONATE_TENANT_COOKIE } from '@/lib/auth/constants';
import { isScopedTenantHostSlug } from '@/lib/utils/parse-tenant-host';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { getAdminTenantsUrl } from '@/lib/utils/tenant-urls';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { TenantProvider } from '@/hooks/useTenant';
import { ActivityTracker } from '@/features/gamification/components/ActivityTracker';
import { MagicTour } from '@/features/onboarding/components/MagicTour';
import { LayoutSidebarGamification } from '@/features/gamification/components/LayoutSidebarGamification';
import { LayoutSidebarGamificationSkeleton } from '@/features/gamification/components/LayoutSidebarGamificationSkeleton';
import { LayoutCommandCenterGamification } from '@/features/gamification/components/LayoutCommandCenterGamification';
import { LayoutInitialNotifications } from '@/features/notifications/components/LayoutInitialNotifications';
import { NotificationBellSkeleton } from '@/features/notifications/components/NotificationBellSkeleton';
import type { SessionUser } from '@/types/user';
import { resolveEffectiveLocale } from '@/lib/i18n/resolve-effective-locale';
import { loadMessages } from '@/lib/i18n/load-messages';

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantContext();
  const slug = ctx?.tenant.slug ?? '';
  const name: string = ctx?.tenant.name ?? slug;
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
  const [session, ctx, cookieStore] = await Promise.all([
    getCachedSession(),
    getTenantContext(),
    cookies(),
  ]);

  if (!session) redirect('/login');
  if (!ctx) notFound();

  const tenant = ctx.tenant;
  const user = session.user as SessionUser;
  const tenantSlug = tenant.slug;

  if (user.role !== 'super_admin' && user.tenantSlug && user.tenantSlug !== tenantSlug) {
    redirect('/unauthorized');
  }

  const canUseNotifications =
    sessionHasPermission(user, 'notifications.view') || sessionHasPermission(user, 'chat.send');

  const impSlug = cookieStore.get(IMPERSONATE_TENANT_COOKIE)?.value?.trim().toLowerCase() ?? '';
  const isImpersonating =
    user.role === 'super_admin' &&
    tenant.slug !== user.tenantSlug &&
    (impSlug === tenant.slug || isScopedTenantHostSlug(tenantSlug));

  const impersonation = isImpersonating
    ? { tenantName: String(tenant.name), exitHref: getAdminTenantsUrl() }
    : null;

  const canManageTeam = sessionHasPermission(user, 'management.users');

  const locale = await resolveEffectiveLocale(user.locale);
  setRequestLocale(locale);
  const messages = loadMessages(locale);
  const tDash = await getTranslations({ locale, namespace: 'Dashboard' });

  const sidebarSlot = (
    <Suspense fallback={<LayoutSidebarGamificationSkeleton tenant={tenant} canManageTeam={canManageTeam} />}>
      <LayoutSidebarGamification tenant={tenant} canManageTeam={canManageTeam} />
    </Suspense>
  );

  const notificationSlot = (
    <Suspense fallback={<NotificationBellSkeleton />}>
      <LayoutInitialNotifications companyId={tenant.id} enabled={canUseNotifications} />
    </Suspense>
  );

  const commandCenterSlot = (
    <Suspense fallback={null}>
      <LayoutCommandCenterGamification companyId={tenant.id} user={user} />
    </Suspense>
  );

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
          sidebarSlot={sidebarSlot}
          notificationSlot={notificationSlot}
          commandCenterSlot={commandCenterSlot}
          impersonation={impersonation}
          showroomMode={Boolean(tenant.is_demo)}
          canManageTeam={canManageTeam}
        >
          {children}
        </DashboardShell>
      </TenantProvider>
    </NextIntlClientProvider>
  );
}
