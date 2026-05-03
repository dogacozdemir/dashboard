'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { ACHIEVEMENT_DEFS, getLevelProgress, getXpToNextLevel } from '../lib/definitions';
import type { XPLevel } from '../types';
import { cn } from '@/lib/utils/cn';

const BG_MAP: Record<string, string> = {
  indigo:  'from-indigo-500/25 to-indigo-500/5 border-indigo-500/25',
  cyan:    'from-cyan-500/25 to-cyan-500/5 border-cyan-500/25',
  violet:  'from-violet-500/25 to-violet-500/5 border-violet-500/25',
  amber:   'from-amber-500/25 to-amber-500/5 border-amber-500/25',
  emerald: 'from-emerald-500/25 to-emerald-500/5 border-emerald-500/25',
  orange:  'from-orange-500/25 to-orange-500/5 border-orange-500/25',
  pink:    'from-pink-500/25 to-pink-500/5 border-pink-500/25',
  teal:    'from-teal-500/25 to-teal-500/5 border-teal-500/25',
  yellow:  'from-yellow-500/25 to-yellow-500/5 border-yellow-500/25',
  white:   'from-white/12 to-white/5 border-white/10',
};

export interface MasteryExperienceProps {
  totalXP:    number;
  level:      XPLevel;
  earnedKeys: string[];
}

export function MasteryExperience({ totalXP, level, earnedKeys }: MasteryExperienceProps) {
  const t    = useTranslations('Features.Gamification.mastery');
  const tXp  = useTranslations('Features.Gamification');
  const tUh  = useTranslations('Features.Gamification.unlockHints');

  const earned = useMemo(() => new Set(earnedKeys), [earnedKeys]);
  const ringPct = getLevelProgress(totalXP);
  const toNext  = getXpToNextLevel(totalXP, level);

  const r  = 108;
  const c  = 2 * Math.PI * r;
  const dash = (ringPct / 100) * c;

  return (
    <div className="relative mx-auto max-w-5xl pb-10">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[min(100%,720px)] -translate-x-1/2 rounded-full opacity-70"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(190,160,66,0.22), rgba(156,112,178,0.12) 40%, transparent 68%)',
          filter: 'blur(36px)',
        }}
        aria-hidden
      />

      <header className="relative text-center mb-10 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#bea042]/80 mb-2">{t('kicker')}</p>
        <h1 className="text-2xl sm:text-3xl font-black text-white/90 tracking-tight">{t('title')}</h1>
        <p className="text-sm text-white/38 mt-2 max-w-xl mx-auto leading-relaxed">{t('subtitle')}</p>
      </header>

      {/* Circular level ring */}
      <div className="relative flex flex-col items-center mb-14">
        <div
          className="relative rounded-[2rem] border border-white/10 p-8 sm:p-10 backdrop-blur-3xl w-full max-w-md mx-auto"
          style={{
            background: 'rgba(18, 10, 20, 0.55)',
            boxShadow:
              '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 24px 80px rgba(0,0,0,0.45), 0 0 100px rgba(190,160,66,0.08)',
          }}
        >
          <div className="pointer-events-none absolute inset-6 rounded-[1.5rem] bg-gradient-to-b from-[#bea042]/8 to-transparent blur-xl" aria-hidden />

          <div className="relative flex flex-col items-center">
            <div className="relative w-[min(92vw,280px)] aspect-square flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_28px_rgba(190,160,66,0.25)]" viewBox="0 0 240 240">
                <circle cx="120" cy="120" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                <motion.circle
                  cx="120"
                  cy="120"
                  r={r}
                  fill="none"
                  stroke="url(#masteryRing)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${c}`}
                  initial={{ strokeDasharray: `0 ${c}` }}
                  animate={{ strokeDasharray: `${dash} ${c}` }}
                  transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
                />
                <defs>
                  <linearGradient id="masteryRing" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e8d48a" />
                    <stop offset="45%" stopColor="#bea042" />
                    <stop offset="100%" stopColor="#9c70b2" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">{t('levelLabel')}</p>
                <p className="text-5xl sm:text-6xl font-black tabular-nums text-white/92 tracking-tight drop-shadow-[0_0_24px_rgba(190,160,66,0.35)]">
                  {level.level}
                </p>
                <p className="text-xs text-white/45 mt-2 font-medium">{tXp(`levelTitles.${level.level}` as Parameters<typeof tXp>[0])}</p>
                <p className="text-lg font-bold text-[#bea042]/95 mt-3 tabular-nums">
                  {totalXP.toLocaleString()} <span className="text-xs font-semibold text-white/35">{tXp('xpLabel')}</span>
                </p>
                {toNext != null ? (
                  <p className="text-[11px] text-white/30 mt-2">
                    {t('toNext', { xp: toNext })}
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-400/80 mt-2">{t('maxLevel')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Badge grid */}
      <section>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4 text-center">
          {t('collectionHeading')}
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 sm:gap-4">
          {ACHIEVEMENT_DEFS.map((def, index) => {
            const has = earned.has(def.key);
            const bg = BG_MAP[def.color] ?? BG_MAP.indigo;
            const hint = tUh(def.key as Parameters<typeof tUh>[0]);

            return (
              <motion.button
                key={def.key}
                type="button"
                title={!has ? hint : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02, type: 'spring', stiffness: 320, damping: 28 }}
                className={cn(
                  'relative flex flex-col items-center justify-center aspect-square rounded-[2rem] border backdrop-blur-3xl overflow-hidden transition-transform active:scale-[0.97]',
                  'border-white/10',
                  has ? 'bg-white/[0.04]' : 'bg-black/20',
                )}
                style={{
                  boxShadow: has
                    ? '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 12px 40px rgba(0,0,0,0.35)'
                    : '0 0 0 0.5px rgba(255,255,255,0.04) inset',
                }}
              >
                <div
                  className={cn(
                    'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
                    has ? bg : 'from-white/[0.06] to-transparent',
                  )}
                  aria-hidden
                />
                {has && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-50"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.35), transparent 55%)',
                    }}
                    aria-hidden
                  />
                )}

                <span
                  className={cn(
                    'relative text-3xl sm:text-4xl leading-none select-none',
                    has ? '' : 'grayscale opacity-20',
                  )}
                >
                  {def.icon}
                </span>

                {!has && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-black/35 backdrop-blur-[2px]">
                    <Lock className="w-5 h-5 text-white/50 drop-shadow-[0_0_12px_rgba(0,0,0,0.8)]" strokeWidth={2.2} />
                  </span>
                )}

                {has && (
                  <span className="absolute bottom-2 text-[9px] font-bold text-amber-300/90 tabular-nums">
                    +{def.xp}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
