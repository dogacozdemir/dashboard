'use client';

import { motion } from 'framer-motion';
import { formatRelativeTime } from '@/lib/utils/format';
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
  const colors = BG_MAP[achievement.color]  ?? BG_MAP.indigo;
  const xpCol  = XP_COLOR[achievement.color] ?? XP_COLOR.indigo;

  if (size === 'sm') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: earned ? 1 : 0.3, scale: 1 }}
        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
        title={`${achievement.title}: ${achievement.desc}`}
        className={`
          relative flex items-center justify-center w-10 h-10 rounded-xl
          bg-gradient-to-br border ${colors}
          ${earned ? '' : 'grayscale'}
        `}
      >
        <span className="text-lg leading-none">{achievement.icon}</span>
        {!earned && (
          <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
            <span className="text-[10px] text-white/30">🔒</span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: earned ? 1 : 0.4, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className={`
        flex items-start gap-3 p-3 rounded-xl
        bg-gradient-to-br border ${colors}
        ${!earned ? 'grayscale' : ''}
      `}
    >
      <div className="text-2xl leading-none mt-0.5 shrink-0">
        {earned ? achievement.icon : '🔒'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-white/85">{achievement.title}</span>
          <span className={`text-[10px] font-bold ${xpCol}`}>+{achievement.xp} XP</span>
        </div>
        <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{achievement.desc}</p>
        {earnedAt && (
          <p className="text-[10px] text-white/20 mt-1">{formatRelativeTime(earnedAt)}</p>
        )}
      </div>
    </motion.div>
  );
}
