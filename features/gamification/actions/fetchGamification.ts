'use server';

import { getCachedSession } from '@/lib/auth/cached-auth';
import { assertTenantScope, requireTenantAction } from '@/lib/auth/tenant-guard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeBrandHealthScore } from '@/features/brand-vault/lib/brandMilestones';
import { isDemoTenant } from '@/lib/demo/is-demo-tenant';
import { showroomLeaderboard, showroomWeeklyDigest } from '@/lib/demo/showroom-data';
import { fetchUserGamificationCached } from '@/features/gamification/data/fetchUserGamificationCached';
import { ACHIEVEMENT_MAP, getLevel } from '../lib/definitions';
import type { UserGamificationData, WeeklyDigestData, LeaderboardEntry } from '../types';
import type { SessionUser } from '@/types/user';

// ─── User gamification data ───────────────────────────────────────────────────

export async function fetchUserGamification(): Promise<UserGamificationData | null> {
  return fetchUserGamificationCached();
}

// ─── Weekly digest ────────────────────────────────────────────────────────────

export async function loadWeeklyDigest(validatedId: string): Promise<WeeklyDigestData> {
  if (await isDemoTenant(validatedId)) return showroomWeeklyDigest();

  const empty: WeeklyDigestData = {
    approvalsThisWeek: 0,
    approvalsLastWeek: 0,
    revisionsThisWeek: 0,
    aiMessagesThisWeek: 0,
    activeDaysThisWeek: 0,
    newAchievements: 0,
  };

  try {
    const supabase = await createSupabaseServerClient();

    const now = new Date();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    thisMonday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const mondayStr = thisMonday.toISOString().split('T')[0];

    const [appThis, appLast, revThis, aiThis, newAch, streakRowsRes] = await Promise.all([
      supabase
        .from('creative_posts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', validatedId)
        .eq('status', 'approved')
        .gte('updated_at', thisMonday.toISOString()),
      supabase
        .from('creative_posts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', validatedId)
        .eq('status', 'approved')
        .gte('updated_at', lastMonday.toISOString())
        .lt('updated_at', thisMonday.toISOString()),
      supabase
        .from('revisions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', validatedId)
        .gte('created_at', thisMonday.toISOString()),
      supabase
        .from('ai_chat_history')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', validatedId)
        .eq('role', 'user')
        .gte('created_at', thisMonday.toISOString()),
      supabase
        .from('user_achievements')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', validatedId)
        .gte('earned_at', thisMonday.toISOString()),
      supabase
        .from('user_streaks')
        .select('last_active_date')
        .eq('tenant_id', validatedId)
        .gte('last_active_date', mondayStr),
    ]);

    const activeDays = new Set(
      (streakRowsRes.data ?? []).map((r) => r.last_active_date as string),
    ).size;

    return {
      approvalsThisWeek: appThis.count ?? 0,
      approvalsLastWeek: appLast.count ?? 0,
      revisionsThisWeek: revThis.count ?? 0,
      aiMessagesThisWeek: aiThis.count ?? 0,
      activeDaysThisWeek: activeDays,
      newAchievements: newAch.count ?? 0,
    };
  } catch (err) {
    console.error('[fetchWeeklyDigest]', err);
    return empty;
  }
}

export async function fetchWeeklyDigest(tenantId: string): Promise<WeeklyDigestData> {
  const validatedId = await assertTenantScope(tenantId);
  return loadWeeklyDigest(validatedId);
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export async function loadLeaderboard(validatedId: string): Promise<LeaderboardEntry[]> {
  if (await isDemoTenant(validatedId)) {
    const session = await getCachedSession();
    const u = session?.user as SessionUser | undefined;
    const name = (u?.name ?? u?.email?.split('@')[0] ?? 'You').trim();
    return showroomLeaderboard(u?.id ?? '00000000-0000-4000-8000-000000000099', name);
  }

  try {
    const supabase = await createSupabaseServerClient();

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

    const users = usersRes.data ?? [];
    const streakMap = new Map((streaksRes.data ?? []).map((s) => [s.user_id, s.current_streak]));

    const badgeMap = new Map<string, number>();
    for (const a of achieveRes.data ?? []) {
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
        userId: u.id,
        displayName: u.full_name ?? u.email?.split('@')[0] ?? '',
        currentStreak: streakMap.get(u.id) ?? 0,
        totalXP: xp,
        badgeCount: badgeMap.get(u.id) ?? 0,
        level: getLevel(xp).level,
      };
    });

    return entries.sort((a, b) => b.totalXP - a.totalXP);
  } catch (err) {
    console.error('[fetchLeaderboard]', err);
    return [];
  }
}

export async function fetchLeaderboard(tenantId: string): Promise<LeaderboardEntry[]> {
  const validatedId = await assertTenantScope(tenantId);
  return loadLeaderboard(validatedId);
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
