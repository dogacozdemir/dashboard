import { getCachedSession } from '@/lib/auth/cached-auth';
import { loadLeaderboard } from '@/features/gamification/actions/fetchGamification';
import { Leaderboard } from '@/features/gamification/components/Leaderboard';
import { getTranslations } from 'next-intl/server';
import type { SessionUser } from '@/types/user';

export async function DashboardLeaderboardSection({ companyId }: { companyId: string }) {
  const [entries, session, tDash] = await Promise.all([
    loadLeaderboard(companyId),
    getCachedSession(),
    getTranslations('Features.DashboardPage'),
  ]);

  const userId = (session?.user as SessionUser | undefined)?.id;

  return (
    <div>
      <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
        {tDash('leaderboardHeading')}
      </h2>
      <Leaderboard entries={entries} currentUserId={userId} />
    </div>
  );
}

export function DashboardLeaderboardSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-3 w-28 rounded bg-white/[0.06]" />
      <div className="h-48 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
    </div>
  );
}
