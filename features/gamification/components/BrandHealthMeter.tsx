'use client';

import { motion } from 'framer-motion';
import { Shield, CheckCircle2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BRAND_MILESTONES } from '@/features/brand-vault/lib/brandMilestones';
import type { BrandAssetType } from '@/features/brand-vault/types';

interface BrandHealthMeterProps {
  assets: { type: BrandAssetType }[];
  score:  number;
}

const ringSpring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

const SCORE_KEYS = [
  { min: 80, labelKey: 'scoreBandExcellent' as const, color: 'text-emerald-400', ring: 'stroke-emerald-400' },
  { min: 50, labelKey: 'scoreBandGood' as const,      color: 'text-cyan-400',    ring: 'stroke-cyan-400'    },
  { min: 25, labelKey: 'scoreBandMedium' as const,    color: 'text-amber-400',   ring: 'stroke-amber-400'   },
  { min: 0,  labelKey: 'scoreBandWeak' as const,      color: 'text-rose-400',    ring: 'stroke-rose-400'    },
];

function getScoreConf(score: number) {
  return SCORE_KEYS.find((c) => score >= c.min) ?? SCORE_KEYS[SCORE_KEYS.length - 1];
}

function RingProgress({ score, scoreOutOf }: { score: number; scoreOutOf: string }) {
  const R = 36;
  const C = 2 * Math.PI * R;
  const conf = getScoreConf(score);

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="50" cy="50" r={R}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={conf.ring}
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C - (score / 100) * C }}
          transition={{ ...ringSpring, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-black tabular-nums ${conf.color}`}>{score}</span>
        <span className="text-[9px] text-white/30 uppercase tracking-wider">{scoreOutOf}</span>
      </div>
    </div>
  );
}

export function BrandHealthMeter({ assets, score }: BrandHealthMeterProps) {
  const t = useTranslations('Features.Gamification');
  const types = new Set(assets.map((a) => a.type));
  const conf  = getScoreConf(score);
  const bandLabel = t(conf.labelKey);

  return (
    <div
      className="relative rounded-3xl border border-white/[0.10] p-5 overflow-hidden"
      style={{
        background: 'rgba(29, 15, 29, 0.45)',
        backdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), inset 1px 0 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(156,112,178,0.15)', border: '1px solid rgba(156,112,178,0.25)' }}
        >
          <Shield className="w-3.5 h-3.5 text-[#b48dc8]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white/85 tracking-tight truncate">{t('brandHealthTitle')}</h3>
          <p className={`text-[10px] font-semibold truncate ${conf.color}`}>{bandLabel}</p>
        </div>
      </div>

      <div className="flex items-start gap-5">
        <RingProgress score={score} scoreOutOf={t('scoreOutOf')} />

        <div className="flex-1 space-y-2 min-w-0">
          {BRAND_MILESTONES.map((item, idx) => {
            const done = types.has(item.type);
            const milestoneLabel = t(`milestones.${item.type}` as Parameters<typeof t>[0]);
            return (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...ringSpring, delay: idx * 0.05 }}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  done ? 'text-white/72' : 'text-white/35'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-rose-400/90 shrink-0" aria-hidden />
                )}
                <span className="mr-auto line-clamp-2 min-w-0">{milestoneLabel}</span>
                <span className={`text-[10px] tabular-nums font-semibold shrink-0 ${done ? 'text-emerald-400' : 'text-rose-400/70'}`}>
                  {t('pointsSuffix', { points: item.points })}
                </span>
              </motion.div>
            );
          })}
          {score < 100 && (
            <p className="text-[10px] text-white/28 pt-1 leading-relaxed line-clamp-3">
              {t('brandHealthFooterHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
