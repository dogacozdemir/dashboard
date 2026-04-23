'use client';

import { motion } from 'framer-motion';
import { Brain, TrendingUp, AlertTriangle, Zap, BarChart3 } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';
import type { MarketInsight } from '../types';

interface MarketInsightCardProps {
  insight: MarketInsight;
  generatedFor: string;
}

export function MarketInsightCard({ insight, generatedFor }: MarketInsightCardProps) {
  const confidenceColor =
    insight.confidence >= 80
      ? 'text-emerald-400'
      : insight.confidence >= 60
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <GlassCard padding="none" glow="indigo">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/80">AI Market Insight</h3>
            <p className="text-[10px] text-white/30 mt-0.5">Generated for {generatedFor} · Powered by DeepSeek</p>
          </div>
        </div>
        <div className={cn('text-xs font-bold tabular-nums', confidenceColor)}>
          {insight.confidence}% confidence
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm text-white/65 leading-relaxed">{insight.summary}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Opportunities */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Opportunities</p>
            </div>
            {insight.opportunities.map((op, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <p className="text-xs text-white/60 leading-relaxed">{op}</p>
              </div>
            ))}
          </motion.div>

          {/* Threats */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Threats</p>
            </div>
            {insight.threats.map((threat, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <p className="text-xs text-white/60 leading-relaxed">{threat}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* GEO Recommendation */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl bg-indigo-500/[0.07] border border-indigo-500/20 p-4 flex gap-3"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">SEO/GEO Strategy</p>
            <p className="text-xs text-white/65 leading-relaxed">{insight.geoRecommendation}</p>
          </div>
        </motion.div>
      </div>
    </GlassCard>
  );
}

export function MarketInsightEmpty() {
  return (
    <GlassCard padding="none" className="border border-dashed border-white/[0.08]">
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
          <Brain className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">Market Insight not available</p>
          <p className="text-xs text-white/25 mt-1">Add your DeepSeek API key to enable AI-generated market analysis</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Set DEEPSEEK_API_KEY in your environment variables</span>
        </div>
      </div>
    </GlassCard>
  );
}
