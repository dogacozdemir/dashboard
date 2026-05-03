import { Suspense, type ReactNode } from 'react';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { OverviewMetrics } from '@/features/performance-hub/components/OverviewMetrics';
import { RecentActivity } from '@/features/performance-hub/components/RecentActivity';
import { CockpitToolbar } from '@/features/performance-hub/components/CockpitToolbar';
import { ExecutiveTrendSection } from '@/features/performance-hub/components/ExecutiveTrendSection';
import { CockpitMetricsCrossfade } from '@/features/performance-hub/components/CockpitMetricsCrossfade';
import { parseCockpitPlatform } from '@/features/performance-hub/lib/cockpit-platform';
import { MetricCardSkeleton, ChartSkeleton } from '@/components/shared/LoadingSkeleton';
import { evaluateImpressionMilestone } from '@/features/gamification/actions/impressionMilestones';
import { DashboardImpressionMilestone } from '@/features/gamification/components/DashboardImpressionMilestone';
import { fetchWeeklyDigest, fetchLeaderboard, fetchUserGamification } from '@/features/gamification/actions/fetchGamification';
import { WeeklyDigest } from '@/features/gamification/components/WeeklyDigest';
import { AchievementBadge } from '@/features/gamification/components/AchievementBadge';
import { Leaderboard } from '@/features/gamification/components/Leaderboard';
import { XPProgress } from '@/features/gamification/components/XPProgress';
import { ACHIEVEMENT_TOTAL_COUNT } from '@/features/gamification/lib/definitions';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/config';
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
  const { companyId, tenant: tenantCtx } = await requireTenantContext();
  const tenant = tenantCtx as Tenant;
  const params = await searchParams;
  const tDash = await getTranslations('Features.DashboardPage');

  if (params.magic === '1') {
    return (
      <MagicOnboardingExperience
        companyId={companyId}
        tenantName={tenant.name}
        connected={params.connected}
      />
    );
  }

  const session = await auth();
  const userId = (session?.user as SessionUser | undefined)?.id;

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

  const [digest, leaderboard, gamification, impressionMilestone] = await Promise.all([
    fetchWeeklyDigest(companyId),
    fetchLeaderboard(companyId),
    fetchUserGamification(),
    evaluateImpressionMilestone(companyId),
  ]);

  const dashboardGoal = (tenant.dashboard_goal as DashboardGoal | undefined) ?? null;

  const gamificationRow = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <WeeklyDigest data={digest} />
      </div>
      {gamification && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{tDash('yourProfile')}</p>
            <span className="text-lg">{gamification.streak.currentStreak >= 7 ? '🔥' : '✨'}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white/85 tabular-nums">{gamification.streak.currentStreak}</span>
              <span className="text-xs text-white/35">{tDash('dailyStreak')}</span>
            </div>
            <XPProgress totalXP={gamification.totalXP} level={gamification.level} compact />
            <p className="text-[10px] text-white/25">
              {tDash('badgesEarned', {
                earned: gamification.achievements.length,
                total: ACHIEVEMENT_TOTAL_COUNT,
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const achievementsShelf =
    gamification && gamification.achievements.length > 0 ? (
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">{tDash('earnedBadgesHeading')}</h2>
        <div className="flex flex-wrap gap-2">
          {gamification.achievements.slice(0, 12).map((a, i) => (
            <AchievementBadge key={a.key} achievement={a} earned earnedAt={a.earnedAt} size="sm" index={i} />
          ))}
        </div>
      </div>
    ) : null;

  const welcomeBanner =
    welcomeCopy != null ? (
      <MonoAiWelcomeBanner
        companyId={companyId}
        copy={welcomeCopy}
        tenantName={tenant.name}
        brandLogoUrl={tenant.brand_logo_url ?? null}
      />
    ) : null;

  const performanceOverview = (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">{tDash('performanceOverview')}</h2>
          <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">{tDash('executiveTrendHeading')}</p>
        </div>
        <CockpitToolbar currentRange={range} currentPlatform={cockpit} showMonoReportExport />
      </div>
      <CockpitMetricsCrossfade cockpit={cockpit} range={range}>
        <div className="flex w-full min-w-0 flex-col gap-8">
          <Suspense fallback={<ChartSkeleton height={240} />}>
            <ExecutiveTrendSection companyId={companyId} range={range} cockpit={cockpit} />
          </Suspense>
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
            />
          </Suspense>
        </div>
      </CockpitMetricsCrossfade>
    </div>
  );

  const leaderboardActivity = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">{tDash('leaderboardHeading')}</h2>
        <Leaderboard entries={leaderboard} currentUserId={userId} />
      </div>
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">{tDash('recentActivity')}</h2>
        <Suspense fallback={<ChartSkeleton height={160} />}>
          <RecentActivity companyId={companyId} />
        </Suspense>
      </div>
    </div>
  );

  const sections = [welcomeBanner, gamificationRow, achievementsShelf, performanceOverview, leaderboardActivity].filter(
    Boolean
  ) as ReactNode[];

  return (
    <div className="cockpit-liquid-scope">
      <DashboardImpressionMilestone result={impressionMilestone} />
      <DashboardRevealMotion sections={sections} />
    </div>
  );
}
