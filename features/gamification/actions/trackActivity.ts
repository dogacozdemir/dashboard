'use server';

import { auth } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ACHIEVEMENT_MAP } from '../lib/definitions';
import type { GamificationEvent } from '../types';
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
    // First time
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

// ─── Grant achievement (idempotent) ──────────────────────────────────────────

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

  // UNIQUE constraint violation → already earned, not an error
  return !error || error.code === '23505';
}

// ─── Check & award achievements based on event ───────────────────────────────

async function checkAchievements(
  userId:   string,
  tenantId: string,
  event:    GamificationEvent,
  ctx:      Record<string, unknown> = {},
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const earned: string[] = [];

  // Helper: does user already have this achievement?
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

      const streak = await updateStreak(userId, tenantId);
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

      // Count total approvals
      const { count } = await supabase
        .from('user_achievements')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .like('achievement_key', 'first_approval');
      if ((count ?? 0) >= 10 && !(await has('approval_10'))) {
        await award('approval_10');
      }

      // Quick approver: check if upload was within 24h (passed via ctx)
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

      // Count total AI messages for this user
      const { count: aiCount } = await supabase
        .from('ai_chat_history')
        .select('id', { count: 'exact' })
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
      // Check brand health score
      const score = (ctx.brandHealthScore as number) ?? 0;
      if (score >= 50  && !(await has('brand_builder_50')))  await award('brand_builder_50');
      if (score >= 100 && !(await has('brand_builder_100'))) await award('brand_builder_100');
      break;
    }

    case 'calendar_event_created': {
      const { count: calCount } = await supabase
        .from('calendar_events')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId);
      if ((calCount ?? 0) >= 10 && !(await has('calendar_pro'))) {
        await award('calendar_pro');
      }
      break;
    }
  }

  return earned;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function trackActivity(
  event:    GamificationEvent,
  ctx:      Record<string, unknown> = {},
): Promise<{ newAchievements: string[] }> {
  try {
    const session = await auth();
    if (!session?.user) return { newAchievements: [] };

    const user = session.user as SessionUser;
    const userId   = user.id;
    const tenantId = user.tenantId;
    if (!userId || !tenantId) return { newAchievements: [] };

    // Always update streak on any activity
    await updateStreak(userId, tenantId);

    const newAchievements = await checkAchievements(userId, tenantId, event, ctx);
    return { newAchievements };
  } catch (err) {
    console.error('[trackActivity]', err);
    return { newAchievements: [] };
  }
}
