import type { AchievementDef, XPLevel } from '../types';

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
  { level: 5, minXP: 2000, maxXP: 3499, color: 'amber' },
  { level: 6, minXP: 3500, maxXP: null, color: 'emerald' },
];

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
