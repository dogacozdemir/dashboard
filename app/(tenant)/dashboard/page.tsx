import { Suspense, type ReactNode } from 'react';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchConnectedAdAccounts } from '@/features/performance-hub/actions/fetchMetrics';
import { getCachedSession } from '@/lib/auth/cached-auth';
import { OverviewMetrics } from '@/features/performance-hub/components/OverviewMetrics';
import { RecentActivity } from '@/features/performance-hub/components/RecentActivity';
import { CockpitToolbar } from '@/features/performance-hub/components/CockpitToolbar';
import { ExecutiveTrendSection } from '@/features/performance-hub/components/ExecutiveTrendSection';
import { CockpitMetricsCrossfade } from '@/features/performance-hub/components/CockpitMetricsCrossfade';
import {
  CockpitHeavyStagger,
  CockpitStaggerSection,
} from '@/features/performance-hub/components/CockpitHeavyStagger';
import { parseCockpitPlatform } from '@/features/performance-hub/lib/cockpit-platform';
import { MetricCardSkeleton, ChartSkeleton } from '@/components/shared/LoadingSkeleton';
import {
  DashboardGamificationRow,
  DashboardGamificationRowSkeleton,
} from '@/features/gamification/components/DashboardGamificationRow';
import {
  DashboardLeaderboardSection,
  DashboardLeaderboardSkeleton,
} from '@/features/gamification/components/DashboardLeaderboardSection';
import { DashboardImpressionMilestoneSection } from '@/features/gamification/components/DashboardImpressionMilestoneSection';
import { MonoAiSuggestions } from '@/features/ai-chat/components/MonoAiSuggestions';
import { getTranslations } from 'next-intl/server';
import { isTenantFreshStart } from '@/features/onboarding/lib/isFreshTenant';
import { fetchMonoWelcomeCopy } from '@/features/onboarding/actions/welcomeCopy';
import { MonoAiWelcomeBanner } from '@/features/onboarding/components/MonoAiWelcomeBanner';
import { MagicOnboardingExperience } from '@/features/onboarding/components/MagicOnboardingExperience';
import { DashboardRevealMotion } from '@/features/onboarding/components/DashboardRevealMotion';
import type { SessionUser } from '@/types/user';
import type { Tenant, DashboardGoal } from '@/types/tenant';

interface PageProps {
  searchParams: Promise<{ range?: string; magic?: string; connected?: string; platform?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const [{ companyId, tenant: tenantCtx }, params, tDash] = await Promise.all([
    requireTenantContext(),
    searchParams,
    getTranslations('Features.DashboardPage'),
  ]);
  const connectedAccounts = await fetchConnectedAdAccounts(companyId);
  const connectedPlatforms = [...new Set(connectedAccounts.map((a) => a.platform))] as Array<
    'meta' | 'google' | 'tiktok'
  >;

  const tenant = tenantCtx as Tenant;

  if (params.magic === '1') {
    return (
      <MagicOnboardingExperience
        companyId={companyId}
        tenantName={tenant.name}
        connected={params.connected}
      />
    );
  }

  const session = await getCachedSession();
  const freshStart = await isTenantFreshStart(companyId);

  let welcomeCopy: Awaited<ReturnType<typeof fetchMonoWelcomeCopy>> | null = null;
  if (freshStart) {
    const u = session?.user as SessionUser | undefined;
    const fallback = tDash('welcomeFallback');
    const rawName = (u?.name ?? u?.email ?? fallback).trim();
    const firstName = rawName.split(/\s+/)[0] || fallback;
    welcomeCopy = await fetchMonoWelcomeCopy({
      tenantName: tenant.name,
      userFirstName: firstName,
      industryHint: tenant.industry ?? null,
      locale: u?.locale ?? 'tr',
    });
  }

  const range = (['daily', 'weekly', 'monthly'] as const).includes(params.range as never)
    ? (params.range as 'daily' | 'weekly' | 'monthly')
    : ('monthly' as const);

  const cockpit = parseCockpitPlatform(params.platform);
  const dashboardGoal = (tenant.dashboard_goal as DashboardGoal | undefined) ?? null;

  const welcomeBanner =
    welcomeCopy != null ? (
      <MonoAiWelcomeBanner
        companyId={companyId}
        copy={welcomeCopy}
        tenantName={tenant.name}
        brandLogoUrl={tenant.brand_logo_url ?? null}
      />
    ) : null;

  const gamificationRow = (
    <Suspense fallback={<DashboardGamificationRowSkeleton />}>
      <DashboardGamificationRow companyId={companyId} />
    </Suspense>
  );

  const performanceOverview = (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">
            {tDash('performanceOverview')}
          </h2>
          <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">
            {tDash('executiveTrendHeading')}
          </p>
        </div>
        <CockpitToolbar currentRange={range} currentPlatform={cockpit} showMonoReportExport connectedPlatforms={connectedPlatforms} />
      </div>
      <CockpitMetricsCrossfade cockpit={cockpit} range={range}>
        <CockpitHeavyStagger>
          <CockpitStaggerSection>
            <Suspense fallback={<ChartSkeleton height={240} />}>
              <ExecutiveTrendSection companyId={companyId} range={range} cockpit={cockpit} />
            </Suspense>
          </CockpitStaggerSection>
          <CockpitStaggerSection>
            <Suspense
              fallback={
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <MetricCardSkeleton key={i} />
                  ))}
                </div>
              }
            >
              <OverviewMetrics
                companyId={companyId}
                range={range}
                dashboardGoal={dashboardGoal}
                cockpitPlatform={cockpit}
                currency={tenant.currency ?? null}
              />
            </Suspense>
          </CockpitStaggerSection>
        </CockpitHeavyStagger>
      </CockpitMetricsCrossfade>
    </div>
  );

  const leaderboardActivity = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Suspense fallback={<DashboardLeaderboardSkeleton />}>
        <DashboardLeaderboardSection companyId={companyId} />
      </Suspense>
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          {tDash('recentActivity')}
        </h2>
        <Suspense fallback={<ChartSkeleton height={160} />}>
          <RecentActivity companyId={companyId} />
        </Suspense>
      </div>
    </div>
  );

  const aiSuggestions = (
    <Suspense fallback={null}>
      <MonoAiSuggestions />
    </Suspense>
  );

  const sections = [
    welcomeBanner,
    gamificationRow,
    performanceOverview,
    aiSuggestions,
    leaderboardActivity,
  ].filter(Boolean) as ReactNode[];

  return (
    <div className="cockpit-liquid-scope">
      <Suspense fallback={null}>
        <DashboardImpressionMilestoneSection companyId={companyId} />
      </Suspense>
      <DashboardRevealMotion sections={sections} />
    </div>
  );
}
