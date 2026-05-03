'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { EarnedAchievement, AchievementDef } from '../types';

const BG_MAP: Record<string, string> = {
  indigo:  'from-indigo-500/20 to-indigo-500/5 border-indigo-500/25',
  cyan:    'from-cyan-500/20 to-cyan-500/5 border-cyan-500/25',
  violet:  'from-violet-500/20 to-violet-500/5 border-violet-500/25',
  amber:   'from-amber-500/20 to-amber-500/5 border-amber-500/25',
  emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/25',
  orange:  'from-orange-500/20 to-orange-500/5 border-orange-500/25',
  pink:    'from-pink-500/20 to-pink-500/5 border-pink-500/25',
  blue:    'from-blue-500/20 to-blue-500/5 border-blue-500/25',
  teal:    'from-teal-500/20 to-teal-500/5 border-teal-500/25',
  yellow:  'from-yellow-500/20 to-yellow-500/5 border-yellow-500/25',
  white:   'from-white/10 to-white/5 border-white/10',
};

const XP_COLOR: Record<string, string> = {
  indigo:  'text-indigo-400',  cyan: 'text-cyan-400',
  violet:  'text-violet-400',  amber: 'text-amber-400',
  emerald: 'text-emerald-400', orange: 'text-orange-400',
  pink:    'text-pink-400',    blue: 'text-blue-400',
  teal:    'text-teal-400',    yellow: 'text-yellow-400',
  white:   'text-white/60',
};

interface AchievementBadgeProps {
  achievement: EarnedAchievement | AchievementDef;
  earned?:     boolean;
  earnedAt?:   string;
  size?:       'sm' | 'md';
  index?:      number;
}

export function AchievementBadge({
  achievement, earned = true, earnedAt, size = 'md', index = 0,
}: AchievementBadgeProps) {
  const t = useTranslations('Features.Gamification');
  const title = t(`achievements.${achievement.key}.title` as Parameters<typeof t>[0]);
  const desc  = t(`achievements.${achievement.key}.desc` as Parameters<typeof t>[0]);
  const colors = BG_MAP[achievement.color]  ?? BG_MAP.indigo;
  const xpCol  = XP_COLOR[achievement.color] ?? XP_COLOR.indigo;

  if (size === 'sm') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: earned ? 1 : 0.2, scale: 1 }}
        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
        title={`${title}: ${desc}`}
        className={cn(
          'relative flex items-center justify-center w-11 h-11 rounded-[2rem] backdrop-blur-3xl bg-gradient-to-br',
          colors,
          earned ? '' : 'grayscale',
        )}
        style={{
          boxShadow: earned
            ? '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 0 22px rgba(255,255,255,0.08)'
            : '0 0 0 0.5px rgba(255,255,255,0.05) inset',
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-50"
          style={{
            background: 'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.35), transparent 62%)',
          }}
          aria-hidden
        />
        <span className="relative text-lg leading-none">{achievement.icon}</span>
        {!earned && (
          <div className="absolute inset-0 rounded-[2rem] bg-black/45 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-[10px] text-white/35">🔒</span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: earned ? 1 : 0.35, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-[2rem] border border-white/10 backdrop-blur-3xl overflow-hidden',
        'bg-gradient-to-br',
        colors,
        !earned ? 'grayscale' : '',
      )}
      style={{
        boxShadow: '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 12px 40px rgba(0,0,0,0.28)',
      }}
    >
      <div className="relative text-2xl leading-none mt-0.5 shrink-0">
        <span
          className="pointer-events-none absolute -inset-3 rounded-full opacity-60 blur-lg bg-white/25"
          aria-hidden
        />
        <span className="relative">{earned ? achievement.icon : '🔒'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-white/85 line-clamp-2">{title}</span>
          <span className={`text-[10px] font-bold shrink-0 ${xpCol}`}>+{achievement.xp} {t('xpLabel')}</span>
        </div>
        <p className="text-xs text-white/40 mt-0.5 leading-relaxed line-clamp-3">{desc}</p>
        {earnedAt && (
          <p className="text-[10px] text-white/20 mt-1">{formatRelativeTime(earnedAt)}</p>
        )}
      </div>
    </motion.div>
  );
}
