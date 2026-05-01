'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { BlueprintChartArea } from '@/components/shared/BentoBlueprintEmpty';
import type { ChartDataPoint } from '../types';

import type { TimeRange } from '../actions/fetchMetrics';

interface SpendChartProps {
  data: ChartDataPoint[];
  range?: TimeRange;
}

const PLATFORM_ORDER = ['meta', 'google', 'tiktok'] as const;

const PLATFORM_COLORS: Record<(typeof PLATFORM_ORDER)[number], string> = {
  meta: '#1877F2',
  google: '#EA4335',
  tiktok: '#E8E8E8',
};

function platformsWithSpend(data: ChartDataPoint[]): Array<(typeof PLATFORM_ORDER)[number]> {
  const sums = PLATFORM_ORDER.map((key) => ({
    key,
    total: data.reduce((acc, d) => acc + d[key], 0),
  }));
  const active = sums.filter((s) => s.total > 0).map((s) => s.key);
  return active.length ? active : [];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass rounded-xl px-4 py-3 text-xs space-y-1.5 border border-white/10">
      <p className="text-white/50 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-white/60 capitalize">{entry.name}</span>
          </span>
          <span className="font-semibold text-white/90">${entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function SpendChart({ data, range = 'monthly' }: SpendChartProps) {
  const t = useTranslations('Performance.spendChart');
  const subtitleRange =
    range === 'daily'
      ? t('rangeDaily')
      : range === 'weekly'
        ? t('rangeWeekly')
        : range === 'monthly'
          ? t('rangeMonthly')
          : t('rangeFallback');

  const keysToPlot = platformsWithSpend(data);
  const subtitleLine =
    keysToPlot.length === 1
      ? `${subtitleRange}${t('subtitleSuffixSingle', { channel: t(`platformLabel.${keysToPlot[0]}`) })}`
      : `${subtitleRange}${t('subtitleSuffix')}`;

  if (!data.length) {
    return (
      <GlassCard padding="md" className="bento-card">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white/80">{t('title')}</h3>
          <p className="text-xs text-white/30 mt-0.5">{subtitleLine}</p>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[200px] px-2 py-4 text-center gap-3 border border-dashed border-white/[0.08] rounded-xl bg-white/[0.02]">
          <BlueprintChartArea />
          <p className="text-xs text-white/35 max-w-sm leading-relaxed">{t('emptyHint')}</p>
        </div>
      </GlassCard>
    );
  }

  if (!keysToPlot.length) {
    return (
      <GlassCard padding="md" className="bento-card">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white/80">{t('title')}</h3>
          <p className="text-xs text-white/30 mt-0.5">{subtitleLine}</p>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[200px] px-2 py-4 text-center gap-3 border border-dashed border-white/[0.08] rounded-xl bg-white/[0.02]">
          <BlueprintChartArea />
          <p className="text-xs text-white/35 max-w-sm leading-relaxed">{t('noSpendInRange')}</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="md" className="bento-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-white/80">{t('title')}</h3>
          <p className="text-xs text-white/30 mt-0.5">{subtitleLine}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            {keysToPlot.map((key) => (
              <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PLATFORM_COLORS[key]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={PLATFORM_COLORS[key]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />

          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(v)}`
            }
          />

          <Tooltip content={<CustomTooltip />} />

          {keysToPlot.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={t(`platformLabel.${key}`)}
              stroke={PLATFORM_COLORS[key]}
              strokeWidth={key === 'tiktok' ? 1.5 : 2}
              fill={`url(#grad-${key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
