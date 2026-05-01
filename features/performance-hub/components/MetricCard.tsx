'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';
import { cn } from '@/lib/utils/cn';
import type { MetricValue } from '../types';

export type TrendSemantics = 'growth' | 'cost' | 'efficiency';

interface MetricCardProps {
  label: string;
  metric: MetricValue;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: React.ReactNode;
  index?: number;
  /** Primary KPI spotlight (e.g. Magic Onboarding goal). */
  spotlight?: boolean;
  /** How to interpret % change: spend/clicks = growth, CPA = cost (down is good), ROAS/CTR = efficiency (down warns gold/red). */
  trendSemantics?: TrendSemantics;
  /** @deprecated Use trendSemantics="cost" */
  invertTrend?: boolean;
}

function trendGood(semantics: TrendSemantics, change: number): boolean | null {
  if (Math.abs(change) < 0.05) return null;
  if (semantics === 'cost') return change < 0;
  if (semantics === 'efficiency') return change > 0;
  return change > 0;
}

export function MetricCard({
  label,
  metric,
  prefix = '',
  suffix = '',
  decimals = 0,
  icon,
  index = 0,
  spotlight = false,
  trendSemantics: trendSemanticsProp,
  invertTrend = false,
}: MetricCardProps) {
  const trendSemantics: TrendSemantics =
    trendSemanticsProp ?? (invertTrend ? 'cost' : 'growth');

  const t = useTranslations('Performance');

  const verdict = trendGood(trendSemantics, metric.change);
  const changePositive = metric.change > 0;

  const showUpIcon =
    verdict === null ? false : trendSemantics === 'cost' ? !changePositive : changePositive;

  const trendClass =
    verdict === null
      ? 'text-white/35'
      : verdict
        ? 'text-emerald-400'
        : trendSemantics === 'efficiency'
          ? 'text-amber-400'
          : 'text-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 1, delay: index * 0.05 }}
    >
      <GlassCard
        hover
        padding="md"
        className={cn(
          'bento-card space-y-4 relative overflow-hidden',
          spotlight &&
            'ring-1 ring-[#bea042]/45 shadow-[0_0_32px_rgba(190,160,66,0.18)]'
        )}
      >
        {spotlight ? (
          <motion.div
            aria-hidden
            className="absolute inset-0 z-[1] rounded-[inherit] pointer-events-none bg-gradient-to-br from-[#bea042]/[0.07] via-transparent to-transparent"
            animate={{ opacity: [0.55, 0.95, 0.55] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}
        <div className="flex items-start justify-between gap-2 relative z-[2]">
          <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em] leading-tight min-h-[20px] line-clamp-2">
            {label}
          </p>
          {icon && (
            <span className="gold-icon opacity-60">{icon}</span>
          )}
        </div>

        <div className="relative z-[2]">
          <AnimatedCounter
            value={metric.current}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
            className="text-[1.65rem] font-bold tracking-tight text-white/92"
          />
        </div>

        <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold relative z-[2]', trendClass)}>
          {verdict === null ? (
            <Minus className="w-3 h-3 shrink-0 opacity-70" />
          ) : showUpIcon ? (
            <TrendingUp className="w-3 h-3 shrink-0" />
          ) : (
            <TrendingDown className="w-3 h-3 shrink-0" />
          )}
          <span>
            {metric.change > 0 ? '+' : ''}
            {metric.change.toFixed(1)}%
          </span>
          <span className="text-white/25 font-normal tracking-normal">{t('metricCard.vsPrev')}</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
