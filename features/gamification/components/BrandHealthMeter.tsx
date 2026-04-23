'use client';

import { motion } from 'framer-motion';
import { Shield, CheckCircle2, Circle } from 'lucide-react';
import type { BrandAssetType } from '@/features/brand-vault/types';

interface BrandHealthMeterProps {
  assets: { type: BrandAssetType }[];
  score:  number;
}

const CHECKLIST: Array<{ type: BrandAssetType; label: string; points: number; icon: string }> = [
  { type: 'logo',           label: 'Logo',          points: 25, icon: '🎨' },
  { type: 'brand-book',     label: 'Brand Book',    points: 25, icon: '📖' },
  { type: 'color-palette',  label: 'Renk Paleti',   points: 20, icon: '🎭' },
  { type: 'font',           label: 'Fontlar',        points: 20, icon: '✍️' },
];

const SCORE_CONFIG = [
  { min: 80, label: 'Mükemmel', color: 'text-emerald-400', ring: 'stroke-emerald-400' },
  { min: 50, label: 'İyi',      color: 'text-cyan-400',    ring: 'stroke-cyan-400'    },
  { min: 25, label: 'Orta',     color: 'text-amber-400',   ring: 'stroke-amber-400'   },
  { min: 0,  label: 'Zayıf',    color: 'text-red-400',     ring: 'stroke-red-400'     },
];

function getScoreConf(score: number) {
  return SCORE_CONFIG.find((c) => score >= c.min) ?? SCORE_CONFIG[SCORE_CONFIG.length - 1];
}

// SVG ring progress
function RingProgress({ score }: { score: number }) {
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
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-black tabular-nums ${conf.color}`}>{score}</span>
        <span className="text-[9px] text-white/30 uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  );
}

export function BrandHealthMeter({ assets, score }: BrandHealthMeterProps) {
  const types   = new Set(assets.map((a) => a.type));
  const conf    = getScoreConf(score);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white/80">Brand Health</h3>
          <p className={`text-[10px] font-semibold ${conf.color}`}>{conf.label}</p>
        </div>
      </div>

      <div className="flex items-start gap-5">
        <RingProgress score={score} />

        <div className="flex-1 space-y-2 min-w-0">
          {CHECKLIST.map((item) => {
            const done = types.has(item.type);
            return (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: CHECKLIST.indexOf(item) * 0.07 }}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  done ? 'text-white/70' : 'text-white/25'
                }`}
              >
                {done
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  : <Circle className="w-3.5 h-3.5 text-white/15 shrink-0" />
                }
                <span className="mr-auto">{item.icon} {item.label}</span>
                <span className={`text-[10px] tabular-nums font-semibold ${done ? 'text-emerald-400' : 'text-white/20'}`}>
                  +{item.points}p
                </span>
              </motion.div>
            );
          })}
          {score < 100 && (
            <p className="text-[10px] text-white/20 pt-1">
              Eksik varlıkları yükleyerek skoru artır
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
