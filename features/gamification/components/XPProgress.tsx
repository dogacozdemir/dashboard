'use client';

import { motion } from 'framer-motion';
import { getLevelProgress, XP_LEVELS } from '../lib/definitions';
import type { XPLevel } from '../types';

const LEVEL_COLORS: Record<string, string> = {
  white:   'from-white/40 to-white/20',
  indigo:  'from-indigo-500 to-indigo-400',
  cyan:    'from-cyan-500 to-cyan-400',
  violet:  'from-violet-500 to-violet-400',
  amber:   'from-amber-500 to-amber-400',
  emerald: 'from-emerald-500 to-emerald-400',
};

const LEVEL_GLOW: Record<string, string> = {
  white:   '',
  indigo:  'shadow-indigo-500/40',
  cyan:    'shadow-cyan-500/40',
  violet:  'shadow-violet-500/40',
  amber:   'shadow-amber-500/40',
  emerald: 'shadow-emerald-500/40',
};

interface XPProgressProps {
  totalXP:  number;
  level:    XPLevel;
  compact?: boolean;
}

export function XPProgress({ totalXP, level, compact = false }: XPProgressProps) {
  const progress   = getLevelProgress(totalXP);
  const gradient   = LEVEL_COLORS[level.color] ?? LEVEL_COLORS.indigo;
  const glow       = LEVEL_GLOW[level.color]   ?? '';
  const nextLevel  = XP_LEVELS.find((l) => l.level === level.level + 1);
  const xpToNext   = nextLevel ? nextLevel.minXP - totalXP : 0;

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Lv.{level.level} · {level.title}
          </span>
          <span className="text-[10px] text-white/30 tabular-nums">{totalXP} XP</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${gradient} shadow-sm ${glow}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-xs font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
            Level {level.level} · {level.title}
          </span>
        </div>
        <span className="text-xs text-white/40 tabular-nums">{totalXP} XP</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/[0.07] overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} shadow-md ${glow}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: 0.4 }}
        />
      </div>
      {nextLevel && (
        <p className="text-[10px] text-white/25">
          Sonraki seviyeye <span className="text-white/50">{xpToNext} XP</span> kaldı
        </p>
      )}
    </div>
  );
}
