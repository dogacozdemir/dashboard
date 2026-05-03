'use server';

import { auth } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isDemoTenant } from '@/lib/demo/is-demo-tenant';
import { computeBrandHealthScore } from '@/features/brand-vault/lib/brandMilestones';
import { ACHIEVEMENT_MAP, getActionXpAmount, getLevel } from '../lib/definitions';
import type { GamificationEvent, GamificationTrackResult } from '../types';
import type { SessionUser } from '@/types/user';

// ─── Streak update ────────────────────────────────────────────────────────────

async function updateStreak(userId: string, tenantId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak, last_active_date')
    .eq('user_id', userId)
    .single();

  if (!existing) {
    await supabase.from('user_streaks').insert({
      user_id:          userId,
      tenant_id:        tenantId,
      current_streak:   1,
      longest_streak:   1,
      last_active_date: today,
    });
    return 1;
  }

  if (existing.last_active_date === today) return existing.current_streak;

  const last = existing.last_active_date
    ? new Date(existing.last_active_date)
    : null;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newStreak =
    last && existing.last_active_date === yesterdayStr
      ? existing.current_streak + 1
      : 1;

  const longest = Math.max(newStreak, existing.longest_streak);

  await supabase
    .from('user_streaks')
    .update({
      current_streak:   newStreak,
      longest_streak:   longest,
      last_active_date: today,
      updated_at:       new Date().toISOString(),
    })
    .eq('user_id', userId);

  return newStreak;
}

// ─── Grant achievement (insert only) ───────────────────────────────────────────

async function grantAchievement(
  userId:   string,
  tenantId: string,
  key:      string,
  metadata: Record<string, unknown> | null = null,
): Promise<boolean> {
  if (!ACHIEVEMENT_MAP.has(key)) return false;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from('user_achievements').insert({
    user_id:         userId,
    tenant_id:       tenantId,
    achievement_key: key,
    metadata,
  });

  if (!error) return true;
  if (error.code === '23505') return false;
  console.error('[grantAchievement]', error.message);
  return false;
}

async function incrementUserXp(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId:   string,
  delta:    number,
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

// ─── Check & award achievements based on event ───────────────────────────────

async function checkAchievements(
  userId:   string,
  tenantId: string,
  event:    GamificationEvent,
  ctx:      Record<string, unknown>,
  streak:   number,
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const earned: string[] = [];

  async function has(key: string): Promise<boolean> {
    const { data } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_key', key)
      .maybeSingle();
    return !!data;
  }

  async function award(key: string, meta: Record<string, unknown> | null = null) {
    if (await grantAchievement(userId, tenantId, key, meta)) {
      earned.push(key);
    }
  }

  switch (event) {
    case 'login': {
      if (!(await has('first_login'))) await award('first_login');

      if (streak >= 3  && !(await has('streak_3')))  await award('streak_3');
      if (streak >= 7  && !(await has('streak_7')))  await award('streak_7');
      if (streak >= 30 && !(await has('streak_30'))) await award('streak_30');
      break;
    }

    case 'creative_uploaded': {
      if (!(await has('first_upload'))) await award('first_upload');
      break;
    }

    case 'creative_approved': {
      if (!(await has('first_approval'))) await award('first_approval');

      const { count: approvedCount } = await supabase
        .from('creative_assets')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'approved');

      if ((approvedCount ?? 0) >= 10 && !(await has('approval_10'))) {
        await award('approval_10');
      }

      if (ctx.uploadedAt) {
        const uploaded = new Date(ctx.uploadedAt as string);
        const diffHrs = (Date.now() - uploaded.getTime()) / 36e5;
        if (diffHrs <= 24 && !(await has('quick_approver'))) {
          await award('quick_approver');
        }
      }
      break;
    }

    case 'revision_added': {
      if (!(await has('first_revision'))) await award('first_revision');
      break;
    }

    case 'ai_message_sent': {
      if (!(await has('ai_explorer'))) await award('ai_explorer');

      const { count: aiCount } = await supabase
        .from('ai_chat_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('role', 'user');
      if ((aiCount ?? 0) >= 50 && !(await has('ai_power_user'))) {
        await award('ai_power_user');
      }
      break;
    }

    case 'pdf_generated': {
      if (!(await has('first_pdf'))) await award('first_pdf');
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

      if (types.has('logo') && !(await has('brand_milestone_logo'))) {
        await award('brand_milestone_logo');
      }
      if (types.has('brand-book') && !(await has('brand_milestone_guidelines'))) {
        await award('brand_milestone_guidelines');
      }
      if (types.has('color-palette') && !(await has('brand_milestone_palette'))) {
        await award('brand_milestone_palette');
      }
      if (types.has('font') && !(await has('brand_milestone_fonts'))) {
        await award('brand_milestone_fonts');
      }

      if (score >= 50  && !(await has('brand_builder_50')))  await award('brand_builder_50');
      if (score >= 100 && !(await has('brand_builder_100'))) await award('brand_builder_100');
      break;
    }

    case 'calendar_event_created': {
      const { count: calCount } = await supabase
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if ((calCount ?? 0) >= 10 && !(await has('calendar_pro'))) {
        await award('calendar_pro');
      }
      break;
    }

    case 'milestone_impressions_check': {
      const total = Number(ctx.totalLifetimeImpressions ?? 0);
      if (total >= 100_000 && !(await has('reach_100k'))) {
        await award('reach_100k');
      }
      break;
    }
  }

  return earned;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function trackActivity(
  event: GamificationEvent,
  ctx:   Record<string, unknown> = {},
): Promise<GamificationTrackResult> {
  const empty: GamificationTrackResult = {
    newAchievements: [],
    leveledUp:       null,
    xpGained:        0,
    totalXP:         0,
  };

  try {
    const session = await auth();
    if (!session?.user) return empty;

    const user     = session.user as SessionUser;
    const userId   = user.id;
    const tenantId = user.tenantId;
    if (!userId || !tenantId) return empty;

    if (await isDemoTenant(tenantId)) {
      const actionXp = getActionXpAmount(event, ctx);
      const badgeXp  = 0;
      const delta      = actionXp + badgeXp;
      const totalXP    = 1800;
      const levelBefore = getLevel(Math.max(0, totalXP - delta));
      const levelAfter  = getLevel(totalXP);
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

    const streak = await updateStreak(userId, tenantId);

    const newAchievements = await checkAchievements(userId, tenantId, event, ctx, streak);

    const actionXp = getActionXpAmount(event, ctx);
    const badgeXp  = newAchievements.reduce((sum, key) => {
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
