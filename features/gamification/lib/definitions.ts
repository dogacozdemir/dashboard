import type { AchievementDef, GamificationEvent, XPLevel } from '../types';

/** Base XP granted on every `trackActivity` call (before badge bonuses). */
export const ACTION_XP: Record<GamificationEvent, number> = {
  login:                   8,
  creative_approved:       22,
  creative_uploaded:       14,
  revision_added:          10,
  ai_message_sent:         5,
  pdf_generated:           36,
  brand_asset_uploaded:    16,
  calendar_event_created:  18,
  milestone_impressions_check: 0,
};

export function getActionXpAmount(
  event: GamificationEvent,
  ctx: Record<string, unknown> = {},
): number {
  const base = ACTION_XP[event] ?? 0;
  if (event === 'creative_uploaded') {
    const n = typeof ctx.batchCount === 'number' && ctx.batchCount >= 1 ? Math.floor(ctx.batchCount) : 1;
    return base * n;
  }
  return base;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: 'first_login', icon: '🚀', color: 'indigo', xp: 50 },
  { key: 'first_upload', icon: '📤', color: 'violet', xp: 100 },
  { key: 'first_approval', icon: '✅', color: 'emerald', xp: 100 },
  { key: 'first_revision', icon: '✏️', color: 'amber', xp: 75 },
  { key: 'quick_approver', icon: '⚡', color: 'yellow', xp: 150 },
  { key: 'approval_10', icon: '🏅', color: 'emerald', xp: 300 },
  { key: 'streak_3', icon: '🔥', color: 'orange', xp: 100 },
  { key: 'streak_7', icon: '🔥', color: 'orange', xp: 250 },
  { key: 'streak_30', icon: '💎', color: 'cyan', xp: 1000 },
  { key: 'ai_explorer', icon: '🤖', color: 'violet', xp: 75 },
  { key: 'ai_power_user', icon: '🧠', color: 'violet', xp: 300 },
  { key: 'first_pdf', icon: '📄', color: 'pink', xp: 150 },
  { key: 'brand_milestone_logo', icon: '🎨', color: 'violet', xp: 40 },
  { key: 'brand_milestone_guidelines', icon: '📖', color: 'amber', xp: 40 },
  { key: 'brand_milestone_palette', icon: '🎭', color: 'cyan', xp: 40 },
  { key: 'brand_milestone_fonts', icon: '✍️', color: 'emerald', xp: 40 },
  { key: 'brand_builder_50', icon: '🏗', color: 'violet', xp: 200 },
  { key: 'brand_builder_100', icon: '👑', color: 'amber', xp: 500 },
  { key: 'calendar_pro', icon: '📅', color: 'teal', xp: 200 },
  { key: 'reach_100k', icon: '👁', color: 'cyan', xp: 400 },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENT_DEFS.map((d) => [d.key, d]));

/** Total earnable achievements (for dashboard copy). */
export const ACHIEVEMENT_TOTAL_COUNT = ACHIEVEMENT_DEFS.length;

export const XP_LEVELS: XPLevel[] = [
  { level: 1, minXP: 0, maxXP: 199, color: 'white' },
  { level: 2, minXP: 200, maxXP: 499, color: 'indigo' },
  { level: 3, minXP: 500, maxXP: 999, color: 'cyan' },
  { level: 4, minXP: 1000, maxXP: 1999, color: 'violet' },
  /** Mastery: Brand Architect — unlocks tenant primary logo (white-label). */
  { level: 5, minXP: 2000, maxXP: 3499, color: 'amber' },
  { level: 6, minXP: 3500, maxXP: null, color: 'emerald' },
];

/** Minimum level to set tenant primary logo from Brand Vault. */
export const BRAND_ARCHITECT_MIN_LEVEL = 5;

export function canSetTenantPrimaryLogo(totalXP: number, role: string): boolean {
  if (role === 'super_admin') return true;
  return getLevel(totalXP).level >= BRAND_ARCHITECT_MIN_LEVEL;
}

export function getLevel(xp: number): XPLevel {
  return [...XP_LEVELS].reverse().find((l) => xp >= l.minXP) ?? XP_LEVELS[0];
}

export function getLevelProgress(xp: number): number {
  const lvl = getLevel(xp);
  if (!lvl.maxXP) return 100;
  const range = lvl.maxXP - lvl.minXP + 1;
  const progress = xp - lvl.minXP;
  return Math.min(100, Math.round((progress / range) * 100));
}

/** XP still needed to reach the next level (null if max level). */
export function getXpToNextLevel(totalXP: number, level: XPLevel): number | null {
  const next = XP_LEVELS.find((l) => l.level === level.level + 1);
  if (!next) return null;
  return Math.max(0, next.minXP - totalXP);
}
