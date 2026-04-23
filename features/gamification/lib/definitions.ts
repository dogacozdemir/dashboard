import type { AchievementDef, XPLevel } from '../types';

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Onboarding ──────────────────────────────────────────────────────────────
  {
    key: 'first_login',
    title: 'İlk Adım',
    desc: 'Dashboarda ilk kez giriş yaptın',
    icon: '🚀', color: 'indigo', xp: 50,
  },

  // ── Creative Studio ─────────────────────────────────────────────────────────
  {
    key: 'first_upload',
    title: 'İlk Yükleme',
    desc: 'İlk kreatifini yükledin',
    icon: '📤', color: 'violet', xp: 100,
  },
  {
    key: 'first_approval',
    title: 'İlk Onay',
    desc: 'İlk kreatifini onayladın',
    icon: '✅', color: 'emerald', xp: 100,
  },
  {
    key: 'first_revision',
    title: 'Detaycı',
    desc: 'İlk revizyon talebini gönderdin',
    icon: '✏️', color: 'amber', xp: 75,
  },
  {
    key: 'quick_approver',
    title: 'Hızlı Onaylayıcı',
    desc: '24 saat içinde kreatif onayladın',
    icon: '⚡', color: 'yellow', xp: 150,
  },
  {
    key: 'approval_10',
    title: 'Onay Ustası',
    desc: '10 kreatif onayladın',
    icon: '🏅', color: 'emerald', xp: 300,
  },

  // ── Streak ──────────────────────────────────────────────────────────────────
  {
    key: 'streak_3',
    title: 'Seri Başlıyor',
    desc: '3 gün üst üste aktif oldun',
    icon: '🔥', color: 'orange', xp: 100,
  },
  {
    key: 'streak_7',
    title: 'Haftalık Seri',
    desc: '7 gün üst üste aktif oldun',
    icon: '🔥', color: 'orange', xp: 250,
  },
  {
    key: 'streak_30',
    title: 'Aylık Efsane',
    desc: '30 gün üst üste aktif oldun',
    icon: '💎', color: 'cyan', xp: 1000,
  },

  // ── Mono AI ─────────────────────────────────────────────────────────────────
  {
    key: 'ai_explorer',
    title: 'AI Kaşifi',
    desc: "Mono AI'ı ilk kez kullandın",
    icon: '🤖', color: 'violet', xp: 75,
  },
  {
    key: 'ai_power_user',
    title: 'AI Uzmanı',
    desc: '50 Mono AI mesajı gönderdin',
    icon: '🧠', color: 'violet', xp: 300,
  },
  {
    key: 'first_pdf',
    title: 'Rapor Ustası',
    desc: 'İlk PDF raporu oluşturdun',
    icon: '📄', color: 'pink', xp: 150,
  },

  // ── Brand Vault ─────────────────────────────────────────────────────────────
  {
    key: 'brand_builder_50',
    title: 'Marka İnşacısı',
    desc: "Brand Vault'u %50 tamamladın",
    icon: '🏗', color: 'blue', xp: 200,
  },
  {
    key: 'brand_builder_100',
    title: 'Marka Efsanesi',
    desc: "Brand Vault'u %100 tamamladın",
    icon: '👑', color: 'amber', xp: 500,
  },

  // ── Calendar & Performance ───────────────────────────────────────────────────
  {
    key: 'calendar_pro',
    title: 'Takvim Uzmanı',
    desc: '10+ takvim etkinliği oluşturdun',
    icon: '📅', color: 'teal', xp: 200,
  },
  {
    key: 'reach_100k',
    title: '100K Görünüm',
    desc: "100K impression'a ulaştın",
    icon: '👁', color: 'cyan', xp: 400,
  },
];

// Map for O(1) lookup
export const ACHIEVEMENT_MAP = new Map(
  ACHIEVEMENT_DEFS.map((d) => [d.key, d])
);

// ── XP Levels ────────────────────────────────────────────────────────────────

export const XP_LEVELS: XPLevel[] = [
  { level: 1, title: 'Yeni Üye',        minXP: 0,    maxXP: 199,   color: 'white'   },
  { level: 2, title: 'Aktif Kullanıcı', minXP: 200,  maxXP: 499,   color: 'indigo'  },
  { level: 3, title: 'Uzman',           minXP: 500,  maxXP: 999,   color: 'cyan'    },
  { level: 4, title: 'Usta',            minXP: 1000, maxXP: 1999,  color: 'violet'  },
  { level: 5, title: 'Elite',           minXP: 2000, maxXP: 3499,  color: 'amber'   },
  { level: 6, title: 'Efsane',          minXP: 3500, maxXP: null,  color: 'emerald' },
];

export function getLevel(xp: number): XPLevel {
  return (
    [...XP_LEVELS].reverse().find((l) => xp >= l.minXP) ?? XP_LEVELS[0]
  );
}

export function getLevelProgress(xp: number): number {
  const lvl = getLevel(xp);
  if (!lvl.maxXP) return 100;
  const range = lvl.maxXP - lvl.minXP + 1;
  const progress = xp - lvl.minXP;
  return Math.min(100, Math.round((progress / range) * 100));
}
