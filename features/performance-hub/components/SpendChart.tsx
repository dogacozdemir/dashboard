'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { GlassCard } from '@/components/shared/GlassCard';
import type { ChartDataPoint } from '../types';

import type { TimeRange } from '../actions/fetchMetrics';

interface SpendChartProps {
  data: ChartDataPoint[];
  range?: TimeRange;
}

const PLATFORM_COLORS = {
  meta:   '#6366F1',
  google: '#10B981',
  tiktok: '#F59E0B',
};

function CustomTooltip({ active, payload, label }: {
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
          <span className="font-semibold text-white/90">
            ${entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

const rangeLabel: Record<string, string> = {
  daily:   'Last 7 days',
  weekly:  'Last 12 weeks',
  monthly: 'Last 12 months',
};

export function SpendChart({ data, range = 'monthly' }: SpendChartProps) {
  const subtitle = rangeLabel[range] ?? 'Last 14 days';

  if (!data.length) {
    return (
      <GlassCard padding="md">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white/80">Ad Spend Trend</h3>
          <p className="text-xs text-white/30 mt-0.5">{subtitle} · all platforms</p>
        </div>
        <div className="flex flex-col items-center justify-center h-[200px] text-center gap-2 border border-dashed border-white/[0.06] rounded-xl">
          <p className="text-sm text-white/25">No spend data available</p>
          <p className="text-xs text-white/15">Connect ad accounts to populate the chart</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="md">
        <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-white/80">Ad Spend Trend</h3>
          <p className="text-xs text-white/30 mt-0.5">{subtitle} · all platforms</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            {Object.entries(PLATFORM_COLORS).map(([key, color]) => (
              <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
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
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />

          <Tooltip content={<CustomTooltip />} />

          {Object.entries(PLATFORM_COLORS).map(([key, color]) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
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

