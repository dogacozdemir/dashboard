'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/shared/GlassCard';

interface GeoVisibilityGaugeProps {
  score: number;
  subtitle?: string;
}

/** Apple-style glass gauge — semi-circular fill, amethyst → gold. */
export function GeoVisibilityGauge({ score, subtitle }: GeoVisibilityGaugeProps) {
  const uid   = useId().replace(/:/g, '');
  const clamp = Math.min(100, Math.max(0, score));
  const cx    = 110;
  const cy    = 100;
  const r     = 80;
  const sw    = 10;
  const half  = Math.PI * r;
  const off   = half - (clamp / 100) * half;
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <GlassCard padding="lg" className="bento-card flex flex-col items-center">
      <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em] self-start w-full mb-4">
        AI visibility index
      </p>
      <div className="relative w-[220px] h-[120px]">
        <svg width="220" height="120" viewBox="0 0 220 120" className="overflow-visible" aria-hidden>
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <motion.path
            d={pathD}
            fill="none"
            stroke={`url(#geoGauge-${uid})`}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={half}
            initial={{ strokeDashoffset: half }}
            animate={{ strokeDashoffset: off }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
          <defs>
            <linearGradient id={`geoGauge-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop stopColor="#9c70b2" />
              <stop offset="0.55" stopColor="#b48dc8" />
              <stop offset="1" stopColor="#bea042" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
          <motion.span
            className="text-4xl font-bold tabular-nums text-white/92"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.08 }}
          >
            {clamp}
          </motion.span>
        </div>
      </div>
      {subtitle && (
        <p className="text-xs text-white/35 text-center mt-3 max-w-[280px] leading-relaxed line-clamp-4">{subtitle}</p>
      )}
    </GlassCard>
  );
}
