'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/shared/GlassCard';

interface CwvRingsProps {
  lcp: number;
  fid: number;
  cls: number;
  lcpRaw?: number;
  fidRaw?: number;
  clsRaw?: number;
}

function Ring({
  label,
  score,
  detail,
  gradId,
  delay,
}: {
  label: string;
  score: number;
  detail?: string;
  gradId: string;
  delay: number;
}) {
  const r = 34;
  const stroke = 4.5;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = c - (clamped / 100) * c;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[88px] h-[88px]">
        <svg width="88" height="88" viewBox="0 0 88 88" className="rotate-[-90deg]" aria-hidden>
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay }}
          />
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop stopColor="#9c70b2" />
              <stop offset="1" stopColor="#bea042" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-bold tabular-nums text-white/90">{Math.round(clamped)}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{label}</p>
        {detail && (
          <p className="text-[10px] text-white/25 tabular-nums mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}

export function CwvRings({ lcp, fid, cls, lcpRaw, fidRaw, clsRaw }: CwvRingsProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <GlassCard padding="md" className="bento-card">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-white/85">Core Web Vitals</h3>
        <p className="text-xs text-white/30 mt-0.5">Engineering health · SSOT from latest SEO snapshot</p>
      </div>
      <div className="flex flex-wrap justify-center gap-8 md:gap-10">
        <Ring
          label="LCP"
          score={lcp}
          detail={lcpRaw != null ? `${lcpRaw.toFixed(2)}s` : undefined}
          gradId={`cwv-lcp-${uid}`}
          delay={0}
        />
        <Ring
          label="FID"
          score={fid}
          detail={fidRaw != null ? `${Math.round(fidRaw)}ms` : undefined}
          gradId={`cwv-fid-${uid}`}
          delay={0.06}
        />
        <Ring
          label="CLS"
          score={cls}
          detail={clsRaw != null ? clsRaw.toFixed(3) : undefined}
          gradId={`cwv-cls-${uid}`}
          delay={0.12}
        />
      </div>
    </GlassCard>
  );
}
