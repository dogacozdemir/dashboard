import { Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import type { GeoStrategyLogContent } from '@/features/strategy/types';

interface AiStrategyInsightCardProps {
  strategy: GeoStrategyLogContent & { logGeneratedAt: string };
}

/** Hero GEO note — gold rim (#bea042), Liquid Glass. */
export function AiStrategyInsightCard({ strategy }: AiStrategyInsightCardProps) {
  return (
    <GlassCard
      padding="lg"
      className="bento-card relative overflow-hidden border-[#bea042]/45 shadow-[0_0_0_1px_rgba(190,160,66,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#bea042]/70 to-transparent pointer-events-none" />
      <div className="flex flex-col md:flex-row md:items-start gap-4 relative z-[1]">
        <div className="w-12 h-12 rounded-2xl bg-[#bea042]/12 border border-[#bea042]/35 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-[#bea042]" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-[10px] font-semibold text-[#bea042]/80 uppercase tracking-[0.14em]">
            AI strategy · GEO engine
          </p>
          <h2 className="text-lg md:text-xl font-semibold text-white/95 tracking-tight leading-snug">
            {strategy.headline}
          </h2>
          <p className="text-sm text-white/55 leading-relaxed">{strategy.summary}</p>
          <p className="text-[10px] text-white/25 pt-1">
            Updated {new Date(strategy.logGeneratedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
