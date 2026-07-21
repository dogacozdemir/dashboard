import { cache } from 'react';
import { getCachedSession } from '@/lib/auth/cached-auth';
import { getTenantContext } from '@/lib/auth/tenant-guard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isDemoTenant } from '@/lib/demo/is-demo-tenant';
import { ACHIEVEMENT_DEFS, ACHIEVEMENT_MAP, getLevel } from '../lib/definitions';
import type { UserStreak, EarnedAchievement, UserGamificationData } from '../types';
import type { SessionUser } from '@/types/user';

/** Request-scoped — one DB read set per user per navigation. */
export const fetchUserGamificationCached = cache(async (): Promise<UserGamificationData | null> => {
  try {
    const session = await getCachedSession();
    if (!session?.user) return null;

    const user = session.user as SessionUser;
    const userId = user.id;
    const ctx = await getTenantContext();
    const tenantId = ctx?.companyId ?? user.tenantId;
    if (!userId || !tenantId) return null;

    if (await isDemoTenant(tenantId)) {
      const today = new Date().toISOString().split('T')[0];
      const achievements = ACHIEVEMENT_DEFS.slice(0, 12).map((def, i) => ({
        ...def,
        earnedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
      }));
      const totalXP = 1800;
      return {
        streak: {
          userId,
          currentStreak: 9,
          longestStreak: 14,
          lastActiveDate: today,
        },
        achievements,
        totalXP,
        level: getLevel(totalXP),
      };
    }

    const supabase = await createSupabaseServerClient();

    const [streakRes, achieveRes, userXpRes] = await Promise.all([
      supabase
        .from('user_streaks')
        .select('current_streak, longest_streak, last_active_date')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_achievements')
        .select('id, user_id, achievement_key, earned_at, metadata')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false }),
      supabase.from('users').select('xp').eq('id', userId).maybeSingle(),
    ]);

    const streak: UserStreak = streakRes.data
      ? {
          userId,
          currentStreak: streakRes.data.current_streak,
          longestStreak: streakRes.data.longest_streak,
          lastActiveDate: streakRes.data.last_active_date,
        }
      : { userId, currentStreak: 0, longestStreak: 0, lastActiveDate: null };

    const achievements: EarnedAchievement[] = (achieveRes.data ?? [])
      .map((r) => {
        const def = ACHIEVEMENT_MAP.get(r.achievement_key);
        if (!def) return null;
        return { ...def, earnedAt: r.earned_at };
      })
      .filter(Boolean) as EarnedAchievement[];

    const totalXP = Number((userXpRes.data as { xp?: number } | null)?.xp ?? 0);
    const level = getLevel(totalXP);

    return { streak, achievements, totalXP, level };
  } catch (err) {
    console.error('[fetchUserGamification]', err);
    return null;
  }
});
