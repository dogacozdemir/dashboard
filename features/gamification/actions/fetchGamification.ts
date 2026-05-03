'use server';

import { auth } from '@/lib/auth/config';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeBrandHealthScore } from '@/features/brand-vault/lib/brandMilestones';
import { isDemoTenant } from '@/lib/demo/is-demo-tenant';
import { showroomLeaderboard, showroomWeeklyDigest } from '@/lib/demo/showroom-data';
import { ACHIEVEMENT_DEFS, ACHIEVEMENT_MAP, getLevel } from '../lib/definitions';
import type {
  UserStreak, EarnedAchievement, UserGamificationData,
  WeeklyDigestData, LeaderboardEntry,
} from '../types';
import type { SessionUser } from '@/types/user';

// ─── User gamification data ───────────────────────────────────────────────────

export async function fetchUserGamification(): Promise<UserGamificationData | null> {
  try {
    const session = await auth();
    if (!session?.user) return null;

    const user      = session.user as SessionUser;
    const userId    = user.id;
    if (!userId || !user.tenantId) return null;

    if (await isDemoTenant(user.tenantId)) {
      const today = new Date().toISOString().split('T')[0];
      const achievements = ACHIEVEMENT_DEFS.slice(0, 12).map((def, i) => ({
        ...def,
        earnedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
      }));
      const totalXP = 1800;
      return {
        streak: {
          userId,
          currentStreak:   9,
          longestStreak:   14,
          lastActiveDate:  today,
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
          userId:          userId,
          currentStreak:   streakRes.data.current_streak,
          longestStreak:   streakRes.data.longest_streak,
          lastActiveDate:  streakRes.data.last_active_date,
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
    const level   = getLevel(totalXP);

    return { streak, achievements, totalXP, level };
  } catch (err) {
    console.error('[fetchUserGamification]', err);
    return null;
  }
}

// ─── Weekly digest ────────────────────────────────────────────────────────────

export async function fetchWeeklyDigest(tenantId: string): Promise<WeeklyDigestData> {
  const validatedId = await requireTenantAction(tenantId);
  if (await isDemoTenant(validatedId)) return showroomWeeklyDigest();
  const empty: WeeklyDigestData = {
    approvalsThisWeek: 0, approvalsLastWeek: 0,
    revisionsThisWeek: 0, aiMessagesThisWeek: 0,
    activeDaysThisWeek: 0, newAchievements: 0,
  };

  try {
    const supabase = await createSupabaseServerClient();

    const now       = new Date();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    thisMonday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const [appThis, appLast, revThis, aiThis, newAch] = await Promise.all([
      supabase
        .from('creative_assets')
        .select('id', { count: 'exact' })
        .eq('tenant_id', validatedId)
        .eq('status', 'approved')
        .gte('created_at', thisMonday.toISOString()),
      supabase
        .from('creative_assets')
        .select('id', { count: 'exact' })
        .eq('tenant_id', validatedId)
        .eq('status', 'approved')
        .gte('created_at', lastMonday.toISOString())
        .lt('created_at', thisMonday.toISOString()),
      supabase
        .from('revisions')
        .select('id', { count: 'exact' })
        .eq('tenant_id', validatedId)
        .gte('created_at', thisMonday.toISOString()),
      supabase
        .from('ai_chat_history')
        .select('id', { count: 'exact' })
        .eq('tenant_id', validatedId)
        .eq('role', 'user')
        .gte('created_at', thisMonday.toISOString()),
      supabase
        .from('user_achievements')
        .select('id', { count: 'exact' })
        .eq('tenant_id', validatedId)
        .gte('earned_at', thisMonday.toISOString()),
    ]);

    // Active days: count distinct active dates from user_streaks updates
    const { data: streakRows } = await supabase
      .from('user_streaks')
      .select('last_active_date')
      .eq('tenant_id', validatedId);

    const activeDays = new Set(
      (streakRows ?? [])
        .filter((r) => r.last_active_date >= thisMonday.toISOString().split('T')[0])
        .map((r) => r.last_active_date)
    ).size;

    return {
      approvalsThisWeek:  appThis.count  ?? 0,
      approvalsLastWeek:  appLast.count  ?? 0,
      revisionsThisWeek:  revThis.count  ?? 0,
      aiMessagesThisWeek: aiThis.count   ?? 0,
      activeDaysThisWeek: activeDays,
      newAchievements:    newAch.count   ?? 0,
    };
  } catch (err) {
    console.error('[fetchWeeklyDigest]', err);
    return empty;
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export async function fetchLeaderboard(tenantId: string): Promise<LeaderboardEntry[]> {
  const validatedId = await requireTenantAction(tenantId);
  if (await isDemoTenant(validatedId)) {
    const session = await auth();
    const u       = session?.user as SessionUser | undefined;
    const name    = (u?.name ?? u?.email?.split('@')[0] ?? 'You').trim();
    return showroomLeaderboard(u?.id ?? '00000000-0000-4000-8000-000000000099', name);
  }
  try {
    const supabase = await createSupabaseServerClient();

    // Get all users in tenant + their streaks + achievement counts
    const [usersRes, streaksRes, achieveRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, full_name, xp')
        .eq('tenant_id', validatedId),
      supabase
        .from('user_streaks')
        .select('user_id, current_streak')
        .eq('tenant_id', validatedId),
      supabase
        .from('user_achievements')
        .select('user_id, achievement_key')
        .eq('tenant_id', validatedId),
    ]);

    const users     = usersRes.data    ?? [];
    const streakMap = new Map((streaksRes.data ?? []).map((s) => [s.user_id, s.current_streak]));

    const badgeMap = new Map<string, number>();
    for (const a of (achieveRes.data ?? [])) {
      const def = ACHIEVEMENT_MAP.get(a.achievement_key);
      if (def) {
        badgeMap.set(a.user_id, (badgeMap.get(a.user_id) ?? 0) + 1);
      }
    }

    const entries: LeaderboardEntry[] = (
      users as Array<{ id: string; email: string; full_name: string | null; xp?: number }>
    ).map((u) => {
      const xp = Number(u.xp ?? 0);
      return {
        userId:        u.id,
        displayName:   u.full_name ?? u.email?.split('@')[0] ?? '',
        currentStreak: streakMap.get(u.id) ?? 0,
        totalXP:       xp,
        badgeCount:    badgeMap.get(u.id) ?? 0,
        level:         getLevel(xp).level,
      };
    });

    // Sort by XP descending
    return entries.sort((a, b) => b.totalXP - a.totalXP);
  } catch (err) {
    console.error('[fetchLeaderboard]', err);
    return [];
  }
}

// ─── Brand health score ───────────────────────────────────────────────────────

export async function fetchBrandHealthScore(tenantId: string): Promise<number> {
  const validatedId = await requireTenantAction(tenantId);
  if (await isDemoTenant(validatedId)) return 82;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from('brand_assets')
      .select('type')
      .eq('tenant_id', validatedId);

    if (!data || data.length === 0) return 0;

    const types = new Set(data.map((a) => a.type));
    return computeBrandHealthScore(types, data.length);
  } catch {
    return 0;
  }
}
