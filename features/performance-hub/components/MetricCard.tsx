'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';
import { cn } from '@/lib/utils/cn';
import type { MetricValue } from '../types';

interface MetricCardProps {
  label: string;
  metric: MetricValue;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: React.ReactNode;
  index?: number;
  /** When true, a decrease is good (e.g. CPA). Flips colour logic. */
  invertTrend?: boolean;
}

export function MetricCard({
  label,
  metric,
  prefix = '',
  suffix = '',
  decimals = 0,
  icon,
  index = 0,
  invertTrend = false,
}: MetricCardProps) {
  const isPositive = invertTrend ? metric.change <= 0 : metric.change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <GlassCard hover padding="md" className="space-y-3">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</p>
          {icon && (
            <span className="text-white/20">{icon}</span>
          )}
        </div>

        <div>
          <AnimatedCounter
            value={metric.current}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
            className="text-2xl font-bold text-white/90"
          />
        </div>

        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          isPositive ? 'text-emerald-400' : 'text-red-400'
        )}>
          {isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{isPositive ? '+' : ''}{metric.change.toFixed(1)}%</span>
          <span className="text-white/25 font-normal">vs last period</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
