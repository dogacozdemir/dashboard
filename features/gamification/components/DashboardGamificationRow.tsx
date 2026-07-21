import { getTranslations } from 'next-intl/server';
import { fetchUserGamificationCached } from '@/features/gamification/data/fetchUserGamificationCached';
import { loadWeeklyDigest } from '@/features/gamification/actions/fetchGamification';
import { WeeklyDigest } from '@/features/gamification/components/WeeklyDigest';
import { XPProgress } from '@/features/gamification/components/XPProgress';
import { AchievementBadge } from '@/features/gamification/components/AchievementBadge';
import { ACHIEVEMENT_TOTAL_COUNT } from '@/features/gamification/lib/definitions';

export async function DashboardGamificationRow({ companyId }: { companyId: string }) {
  const [digest, gamification, tDash] = await Promise.all([
    loadWeeklyDigest(companyId),
    fetchUserGamificationCached(),
    getTranslations('Features.DashboardPage'),
  ]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <WeeklyDigest data={digest} />
        </div>
        {gamification && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                {tDash('yourProfile')}
              </p>
              <span className="text-lg">{gamification.streak.currentStreak >= 7 ? '🔥' : '✨'}</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white/85 tabular-nums">
                  {gamification.streak.currentStreak}
                </span>
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
      {gamification && gamification.achievements.length > 0 ? (
        <div>
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
            {tDash('earnedBadgesHeading')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {gamification.achievements.slice(0, 12).map((a, i) => (
              <AchievementBadge
                key={a.key}
                achievement={a}
                earned
                earnedAt={a.earnedAt}
                size="sm"
                index={i}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DashboardGamificationRowSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
      <div className="lg:col-span-2 h-36 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
      <div className="h-36 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
    </div>
  );
}
