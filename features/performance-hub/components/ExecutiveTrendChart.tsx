'use client';

import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import type { ExecutiveTrendPoint } from '../actions/fetchMetrics';

interface ExecutiveTrendChartProps {
  data: ExecutiveTrendPoint[];
}

export function ExecutiveTrendChart({ data }: ExecutiveTrendChartProps) {
  const t = useTranslations('Performance.cockpit.executiveTrend');

  const chartData = data.map((row) => ({
    ...row,
    label: new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <GlassCard
      padding="md"
      className="bento-card rounded-[2rem] border-white/10 backdrop-blur-3xl saturate-200"
    >
      <div className="mb-5 relative z-[2]">
        <h3 className="text-sm font-semibold text-white/88 tracking-tight">{t('title')}</h3>
        <p className="text-[11px] text-white/38 mt-1 leading-relaxed">{t('subtitle')}</p>
      </div>

      <div className="h-[220px] w-full relative z-[2]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="execSpendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#bea042" stopOpacity={0.45} />
                <stop offset="92%" stopColor="#bea042" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="execRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.42} />
                <stop offset="92%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="spend"
              tick={{ fill: 'rgba(190,160,66,0.55)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)}
            />
            <YAxis
              yAxisId="rev"
              orientation="right"
              tick={{ fill: 'rgba(129,140,248,0.55)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const spend = payload.find((p) => p.dataKey === 'spend')?.value as number;
                const revenue = payload.find((p) => p.dataKey === 'revenue')?.value as number;
                return (
                  <div className="rounded-xl border border-white/10 bg-[#0a0810]/90 backdrop-blur-xl px-3 py-2 text-[11px] space-y-1">
                    <p className="text-white/45">{label}</p>
                    <p className="text-[#bea042] font-semibold">
                      {t('tooltipSpend', {
                        amount: new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        }).format(spend ?? 0),
                      })}
                    </p>
                    <p className="text-indigo-300 font-semibold">
                      {t('tooltipRevenue', {
                        amount: new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        }).format(revenue ?? 0),
                      })}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              yAxisId="spend"
              type="monotone"
              dataKey="spend"
              stroke="#bea042"
              strokeWidth={2}
              fill="url(#execSpendGrad)"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              yAxisId="rev"
              type="monotone"
              dataKey="revenue"
              stroke="#818cf8"
              strokeWidth={2}
              fill="url(#execRevGrad)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-white/35 relative z-[2]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#bea042]" />
          {t('legendSpend')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-400" />
          {t('legendRevenue')}
        </span>
      </div>
    </GlassCard>
  );
}
