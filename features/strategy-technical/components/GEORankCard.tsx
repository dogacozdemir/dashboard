'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Brain, Globe, Search, Radar } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';
import type { GeoReport, GeoEngine } from '../types';

const engineConfig: Record<GeoEngine, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  chatgpt:   { label: 'ChatGPT',   icon: Brain,  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  perplexity:{ label: 'Perplexity',icon: Search, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  google:    { label: 'Google',    icon: Globe,  color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  bing:      { label: 'Bing',      icon: Globe,  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
};

interface GEORankCardProps {
  reports: GeoReport[];
}

export function GEORankCard({ reports }: GEORankCardProps) {
  const citedCount  = reports.filter((r) => r.rankData.cited).length;
  const rankedCount = reports.filter((r) => r.rankData.position !== null).length;

  if (reports.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-4 py-10 text-center border border-dashed border-white/[0.08]" padding="lg">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
          <Radar className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">No GEO reports yet</p>
          <p className="text-xs text-white/25 mt-1">Keyword tracking across ChatGPT, Perplexity, Google and Bing will appear here</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard padding="md" glow="indigo">
          <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">AI Citations</p>
          <p className="text-3xl font-bold text-indigo-400">{citedCount}</p>
          <p className="text-xs text-white/30 mt-1">of {reports.length} keywords</p>
        </GlassCard>
        <GlassCard padding="md" glow="cyan">
          <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Ranked Keywords</p>
          <p className="text-3xl font-bold text-cyan-400">{rankedCount}</p>
          <p className="text-xs text-white/30 mt-1">across all engines</p>
        </GlassCard>
      </div>

      {/* Report table */}
      <GlassCard padding="none">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white/80">GEO Keyword Rankings</h3>
          <p className="text-xs text-white/30 mt-0.5">Generative Engine Optimization tracking</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {reports.map((report, i) => {
            const engine = engineConfig[report.engine];
            const Icon = engine.icon;
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 mt-0.5',
                  engine.color
                )}>
                  <Icon className="w-3 h-3" />
                  {engine.label}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">{report.keyword}</p>
                  {report.rankData.snippet && (
                    <p className="text-xs text-white/30 mt-1 line-clamp-1 italic">
                      &ldquo;{report.rankData.snippet}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {report.rankData.position !== null ? (
                    <div className="text-center">
                      <p className="text-lg font-bold text-white/80 tabular-nums">#{report.rankData.position}</p>
                      <p className="text-[9px] text-white/25 uppercase">rank</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-white/25">—</p>
                    </div>
                  )}

                  {report.rankData.cited ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-white/20" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
