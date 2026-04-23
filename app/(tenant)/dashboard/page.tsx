import { Suspense } from 'react';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { OverviewMetrics } from '@/features/performance-hub/components/OverviewMetrics';
import { RecentActivity } from '@/features/performance-hub/components/RecentActivity';
import { TimeRangeFilter } from '@/features/performance-hub/components/TimeRangeFilter';
import { MetricCardSkeleton, ChartSkeleton } from '@/components/shared/LoadingSkeleton';
import { fetchWeeklyDigest, fetchLeaderboard, fetchUserGamification } from '@/features/gamification/actions/fetchGamification';
import { WeeklyDigest } from '@/features/gamification/components/WeeklyDigest';
import { AchievementBadge } from '@/features/gamification/components/AchievementBadge';
import { Leaderboard } from '@/features/gamification/components/Leaderboard';
import { XPProgress } from '@/features/gamification/components/XPProgress';
import { auth } from '@/lib/auth/config';
import type { SessionUser } from '@/types/user';

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { companyId } = await requireTenantContext();
  const params = await searchParams;
  const range = (['daily', 'weekly', 'monthly'] as const).includes(params.range as never)
    ? (params.range as 'daily' | 'weekly' | 'monthly')
    : ('monthly' as const);

  const session = await auth();
  const userId  = (session?.user as SessionUser | undefined)?.id;

  const [digest, leaderboard, gamification] = await Promise.all([
    fetchWeeklyDigest(companyId),
    fetchLeaderboard(companyId),
    fetchUserGamification(),
  ]);

  return (
    <div className="space-y-6">

      {/* ── Gamification row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Digest (spans 2 cols) */}
        <div className="lg:col-span-2">
          <WeeklyDigest data={digest} />
        </div>

        {/* XP card */}
        {gamification && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                Senin Profil
              </p>
              <span className="text-lg">
                {gamification.streak.currentStreak >= 7 ? '🔥' : '✨'}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white/85 tabular-nums">
                  {gamification.streak.currentStreak}
                </span>
                <span className="text-xs text-white/35">günlük seri</span>
              </div>
              <XPProgress totalXP={gamification.totalXP} level={gamification.level} compact />
              <p className="text-[10px] text-white/25">
                {gamification.achievements.length} / 16 rozet kazanıldı
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Earned achievements shelf ── */}
      {gamification && gamification.achievements.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
            Kazanılan Rozetler
          </h2>
          <div className="flex flex-wrap gap-2">
            {gamification.achievements.slice(0, 12).map((a, i) => (
              <AchievementBadge key={a.key} achievement={a} earned earnedAt={a.earnedAt} size="sm" index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Performance overview ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">
            Performance Overview
          </h2>
          <TimeRangeFilter current={range} />
        </div>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(7)].map((_, i) => <MetricCardSkeleton key={i} />)}
            </div>
          }
        >
          <OverviewMetrics companyId={companyId} range={range} />
        </Suspense>
      </div>

      {/* ── Leaderboard + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
            Sıralama
          </h2>
          <Leaderboard entries={leaderboard} currentUserId={userId} />
        </div>
        <div>
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
            Recent Activity
          </h2>
          <Suspense fallback={<ChartSkeleton height={160} />}>
            <RecentActivity companyId={companyId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
