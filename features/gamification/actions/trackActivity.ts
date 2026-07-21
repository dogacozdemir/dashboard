'use server';

import { getCachedSession } from '@/lib/auth/cached-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isDemoTenant } from '@/lib/demo/is-demo-tenant';
import { computeBrandHealthScore } from '@/features/brand-vault/lib/brandMilestones';
import { businessDateString } from '@/lib/utils/business-date';
import { ACHIEVEMENT_MAP, getActionXpAmount, getLevel } from '../lib/definitions';
import type { GamificationEvent, GamificationTrackResult } from '../types';
import type { SessionUser } from '@/types/user';

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// ─── Streak update ────────────────────────────────────────────────────────────

async function updateStreak(
  supabase: ServerSupabase,
  userId: string,
  tenantId: string,
): Promise<number> {
  const today = businessDateString();

  const { data: existing } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak, last_active_date')
    .eq('user_id', userId)
    .single();

  if (!existing) {
    await supabase.from('user_streaks').insert({
      user_id: userId,
      tenant_id: tenantId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    return 1;
  }

  if (existing.last_active_date === today) return existing.current_streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = businessDateString(yesterday);

  const newStreak =
    existing.last_active_date === yesterdayStr ? existing.current_streak + 1 : 1;

  const longest = Math.max(newStreak, existing.longest_streak);

  await supabase
    .from('user_streaks')
    .update({
      current_streak: newStreak,
      longest_streak: longest,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return newStreak;
}

// ─── Grant achievement (insert only) ───────────────────────────────────────────

async function grantAchievement(
  supabase: ServerSupabase,
  userId: string,
  tenantId: string,
  key: string,
  metadata: Record<string, unknown> | null = null,
): Promise<boolean> {
  if (!ACHIEVEMENT_MAP.has(key)) return false;

  const { error } = await supabase.from('user_achievements').insert({
    user_id: userId,
    tenant_id: tenantId,
    achievement_key: key,
    metadata,
  });

  if (!error) return true;
  if (error.code === '23505') return false;
  console.error('[grantAchievement]', error.message);
  return false;
}

async function incrementUserXp(
  supabase: ServerSupabase,
  userId: string,
  delta: number,
  xpBefore: number,
): Promise<number> {
  if (delta === 0) return xpBefore;
  const next = xpBefore + delta;
  const { error } = await supabase.from('users').update({ xp: next }).eq('id', userId);
  if (error) {
    console.error('[incrementUserXp]', error.message);
    return xpBefore;
  }
  return next;
}

async function loadEarnedAchievementKeys(
  supabase: ServerSupabase,
  userId: string,
  candidateKeys: string[],
): Promise<Set<string>> {
  const unique = [...new Set(candidateKeys.filter((k) => ACHIEVEMENT_MAP.has(k)))];
  if (!unique.length) return new Set();

  const { data } = await supabase
    .from('user_achievements')
    .select('achievement_key')
    .eq('user_id', userId)
    .in('achievement_key', unique);

  return new Set((data ?? []).map((r) => r.achievement_key as string));
}

function collectCandidateKeys(
  event: GamificationEvent,
  ctx: Record<string, unknown>,
  streak: number,
): string[] {
  const keys: string[] = [];

  switch (event) {
    case 'login':
      keys.push('first_login');
      if (streak >= 3) keys.push('streak_3');
      if (streak >= 7) keys.push('streak_7');
      if (streak >= 30) keys.push('streak_30');
      break;
    case 'creative_uploaded':
      keys.push('first_upload');
      break;
    case 'creative_approved':
      keys.push('first_approval', 'approval_10', 'quick_approver');
      break;
    case 'revision_added':
      keys.push('first_revision');
      break;
    case 'ai_message_sent':
      keys.push('ai_explorer', 'ai_power_user');
      break;
    case 'pdf_generated':
      keys.push('first_pdf');
      break;
    case 'brand_asset_uploaded':
      keys.push(
        'brand_milestone_logo',
        'brand_milestone_guidelines',
        'brand_milestone_palette',
        'brand_milestone_fonts',
        'brand_builder_50',
        'brand_builder_100',
      );
      break;
    case 'calendar_event_created':
      keys.push('calendar_pro');
      break;
    case 'milestone_impressions_check':
      if (Number(ctx.totalLifetimeImpressions ?? 0) >= 100_000) {
        keys.push('reach_100k');
      }
      break;
  }

  return keys;
}

// ─── Check & award achievements based on event ───────────────────────────────

async function checkAchievements(
  supabase: ServerSupabase,
  userId: string,
  tenantId: string,
  event: GamificationEvent,
  ctx: Record<string, unknown>,
  streak: number,
): Promise<string[]> {
  const earned: string[] = [];
  const candidateKeys = collectCandidateKeys(event, ctx, streak);
  const alreadyEarned = await loadEarnedAchievementKeys(supabase, userId, candidateKeys);

  async function awardIfMissing(key: string, meta: Record<string, unknown> | null = null) {
    if (alreadyEarned.has(key)) return;
    if (await grantAchievement(supabase, userId, tenantId, key, meta)) {
      alreadyEarned.add(key);
      earned.push(key);
    }
  }

  switch (event) {
    case 'login': {
      await awardIfMissing('first_login');
      if (streak >= 3) await awardIfMissing('streak_3');
      if (streak >= 7) await awardIfMissing('streak_7');
      if (streak >= 30) await awardIfMissing('streak_30');
      break;
    }

    case 'creative_uploaded': {
      await awardIfMissing('first_upload');
      break;
    }

    case 'creative_approved': {
      await awardIfMissing('first_approval');

      const { count: approvedCount } = await supabase
        .from('creative_posts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'approved');

      if ((approvedCount ?? 0) >= 10) await awardIfMissing('approval_10');

      if (ctx.uploadedAt) {
        const uploaded = new Date(ctx.uploadedAt as string);
        const diffHrs = (Date.now() - uploaded.getTime()) / 36e5;
        if (diffHrs <= 24) await awardIfMissing('quick_approver');
      }
      break;
    }

    case 'revision_added': {
      await awardIfMissing('first_revision');
      break;
    }

    case 'ai_message_sent': {
      await awardIfMissing('ai_explorer');

      const { count: aiCount } = await supabase
        .from('ai_chat_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('role', 'user');
      if ((aiCount ?? 0) >= 50) await awardIfMissing('ai_power_user');
      break;
    }

    case 'pdf_generated': {
      await awardIfMissing('first_pdf');
      break;
    }

    case 'brand_asset_uploaded': {
      const { data: rows } = await supabase
        .from('brand_assets')
        .select('type')
        .eq('tenant_id', tenantId);

      const list = rows ?? [];
      const types = new Set(list.map((r) => r.type));
      const score = computeBrandHealthScore(types, list.length);

      if (types.has('logo')) await awardIfMissing('brand_milestone_logo');
      if (types.has('brand-book')) await awardIfMissing('brand_milestone_guidelines');
      if (types.has('color-palette')) await awardIfMissing('brand_milestone_palette');
      if (types.has('font')) await awardIfMissing('brand_milestone_fonts');

      if (score >= 50) await awardIfMissing('brand_builder_50');
      if (score >= 100) await awardIfMissing('brand_builder_100');
      break;
    }

    case 'calendar_event_created': {
      const { count: calCount } = await supabase
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if ((calCount ?? 0) >= 10) await awardIfMissing('calendar_pro');
      break;
    }

    case 'milestone_impressions_check': {
      await awardIfMissing('reach_100k');
      break;
    }
  }

  return earned;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function trackActivity(
  event: GamificationEvent,
  ctx: Record<string, unknown> = {},
): Promise<GamificationTrackResult> {
  const empty: GamificationTrackResult = {
    newAchievements: [],
    leveledUp: null,
    xpGained: 0,
    totalXP: 0,
  };

  try {
    const session = await getCachedSession();
    if (!session?.user) return empty;

    const user = session.user as SessionUser;
    const userId = user.id;
    const tenantId = user.tenantId;
    if (!userId || !tenantId) return empty;

    if (await isDemoTenant(tenantId)) {
      const actionXp = getActionXpAmount(event, ctx);
      const delta = actionXp;
      const totalXP = 1800;
      const levelBefore = getLevel(Math.max(0, totalXP - delta));
      const levelAfter = getLevel(totalXP);
      return {
        newAchievements: [],
        leveledUp:
          levelAfter.level > levelBefore.level
            ? { from: levelBefore.level, to: levelAfter.level }
            : null,
        xpGained: delta,
        totalXP,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { data: xpRow } = await supabase.from('users').select('xp').eq('id', userId).maybeSingle();
    const xpBefore = Number((xpRow as { xp?: number } | null)?.xp ?? 0);
    const levelBefore = getLevel(xpBefore);

    const streak = await updateStreak(supabase, userId, tenantId);
    const newAchievements = await checkAchievements(supabase, userId, tenantId, event, ctx, streak);

    const actionXp = getActionXpAmount(event, ctx);
    const badgeXp = newAchievements.reduce((sum, key) => {
      const def = ACHIEVEMENT_MAP.get(key);
      return sum + (def?.xp ?? 0);
    }, 0);
    const delta = actionXp + badgeXp;

    const totalXP = await incrementUserXp(supabase, userId, delta, xpBefore);

    const levelAfter = getLevel(totalXP);
    const leveledUp =
      levelAfter.level > levelBefore.level
        ? { from: levelBefore.level, to: levelAfter.level }
        : null;

    return {
      newAchievements,
      leveledUp,
      xpGained: delta,
      totalXP,
    };
  } catch (err) {
    console.error('[trackActivity]', err);
    return empty;
  }
}
