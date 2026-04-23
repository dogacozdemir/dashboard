'use client';

import { motion } from 'framer-motion';
import type { UserStreak } from '../types';

interface StreakCounterProps {
  streak:    UserStreak;
  compact?:  boolean;
}

export function StreakCounter({ streak, compact = false }: StreakCounterProps) {
  const current = streak.currentStreak;

  const flame =
    current >= 30 ? '💎' :
    current >= 7  ? '🔥' :
    current >= 3  ? '🔥' :
    '✨';

  const color =
    current >= 30 ? 'text-cyan-400'   :
    current >= 7  ? 'text-orange-400' :
    current >= 3  ? 'text-amber-400'  :
    'text-white/40';

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none">{flame}</span>
        <span className={`text-xs font-bold tabular-nums ${color}`}>{current}</span>
        <span className="text-[10px] text-white/25">gün</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <motion.span
        className="text-2xl leading-none"
        animate={current >= 3 ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
      >
        {flame}
      </motion.span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-black tabular-nums ${color}`}>{current}</span>
          <span className="text-xs text-white/40">günlük seri</span>
        </div>
        <p className="text-[10px] text-white/25">
          En uzun: {streak.longestStreak} gün
        </p>
      </div>
    </div>
  );
}
