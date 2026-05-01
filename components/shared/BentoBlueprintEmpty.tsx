import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';

const strokeGold = 'rgba(190,160,66,0.45)';
const strokeMuted = 'rgba(255,255,255,0.14)';

/** Wireframe line chart — “impressions / traffic” narrative */
export function BlueprintSparkTrend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 52" className={cn('w-full h-14', className)} aria-hidden>
      <rect x="2" y="4" width="136" height="44" rx="6" fill="none" stroke={strokeMuted} strokeWidth="0.9" strokeDasharray="5 4" />
      <path
        d="M12 38 L32 30 L52 34 L72 22 L92 26 L112 14 L128 18"
        fill="none"
        stroke={strokeGold}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="4 3"
      />
      <line x1="12" y1="42" x2="128" y2="42" stroke={strokeMuted} strokeWidth="0.6" strokeDasharray="3 3" />
    </svg>
  );
}

/** Bar silhouette — “volume / visits” */
export function BlueprintBars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 52" className={cn('w-full h-14', className)} aria-hidden>
      <rect x="2" y="4" width="136" height="44" rx="6" fill="none" stroke={strokeMuted} strokeWidth="0.9" strokeDasharray="5 4" />
      {[12, 32, 52, 72, 92, 112].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={38 - (i + 2) * 4}
          width="10"
          height={(i + 2) * 4}
          rx="1.5"
          fill="none"
          stroke={i % 2 === 0 ? strokeGold : strokeMuted}
          strokeWidth="0.9"
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

/** CTR / ratio dial sketch */
export function BlueprintRatioArc({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 52" className={cn('w-full h-14', className)} aria-hidden>
      <rect x="2" y="4" width="136" height="44" rx="6" fill="none" stroke={strokeMuted} strokeWidth="0.9" strokeDasharray="5 4" />
      <path
        d="M 38 40 A 22 22 0 0 1 102 40"
        fill="none"
        stroke={strokeGold}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="6 4"
      />
      <line x1="70" y1="40" x2="88" y2="22" stroke={strokeMuted} strokeWidth="0.8" strokeDasharray="2 2" />
    </svg>
  );
}

/** Rank / position ladder */
export function BlueprintRankLadder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 52" className={cn('w-full h-14', className)} aria-hidden>
      <rect x="2" y="4" width="136" height="44" rx="6" fill="none" stroke={strokeMuted} strokeWidth="0.9" strokeDasharray="5 4" />
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="16"
          y1={14 + i * 9}
          x2={120 - i * 18}
          y2={14 + i * 9}
          stroke={i === 1 ? strokeGold : strokeMuted}
          strokeWidth="0.9"
          strokeDasharray={i === 1 ? '5 3' : '3 4'}
        />
      ))}
    </svg>
  );
}

export interface BentoBlueprintSlotProps {
  title: string;
  caption: string;
  children: React.ReactNode;
  className?: string;
}

export function BentoBlueprintSlot({ title, caption, children, className }: BentoBlueprintSlotProps) {
  return (
    <GlassCard
      padding="md"
      className={cn(
        'bento-card border border-dashed border-white/[0.12] bg-white/[0.02]',
        className
      )}
    >
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.14em]">{title}</p>
      <div className="mt-3 opacity-90">{children}</div>
      <p className="text-[11px] text-white/32 mt-3 leading-snug">{caption}</p>
    </GlassCard>
  );
}

/** Full chart area blueprint (Performance hub empty chart) */
export function BlueprintChartArea({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 120" className={cn('w-full h-[120px]', className)} aria-hidden>
      <rect x="4" y="8" width="312" height="104" rx="8" fill="none" stroke={strokeMuted} strokeWidth="1" strokeDasharray="6 5" />
      <path
        d="M24 88 L64 72 L104 78 L144 52 L184 60 L224 38 L264 44 L296 28"
        fill="none"
        stroke={strokeGold}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="5 4"
        opacity={0.9}
      />
      <line x1="24" y1="96" x2="296" y2="96" stroke={strokeMuted} strokeWidth="0.7" strokeDasharray="4 4" />
    </svg>
  );
}
