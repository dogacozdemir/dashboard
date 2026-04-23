import Link from 'next/link';
import { fetchAggregateMetrics } from '../actions/fetchMetrics';
import { MetricCard } from './MetricCard';
import { DollarSign, TrendingUp, MousePointer, Eye, Percent, Target, Plug } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import type { TimeRange } from '../actions/fetchMetrics';

interface OverviewMetricsProps {
  companyId: string;
  range?: TimeRange;
}

const PLATFORMS = [
  { label: 'Meta Ads',    href: '/api/oauth/meta',    color: 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20' },
  { label: 'Google Ads',  href: '/api/oauth/google',  color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20' },
  { label: 'TikTok Ads',  href: '/api/oauth/tiktok',  color: 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20' },
];

export async function OverviewMetrics({ companyId, range = 'monthly' }: OverviewMetricsProps) {
  const agg = await fetchAggregateMetrics(companyId, range);

  if (!agg.hasData) {
    return (
      <GlassCard padding="lg" className="flex flex-col items-center justify-center gap-5 py-10 text-center border border-dashed border-white/10">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
          <Plug className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/70">No performance data yet</p>
          <p className="text-xs text-white/30 mt-1">Connect your ad accounts to start seeing live metrics</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {PLATFORMS.map((p) => (
            <Link
              key={p.label}
              href={p.href}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${p.color}`}
            >
              Connect {p.label}
            </Link>
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="Total Spend"      metric={agg.spend}          prefix="$"  decimals={0} icon={<DollarSign  className="w-4 h-4" />} index={0} />
      <MetricCard label="Impressions"      metric={agg.impressions}               decimals={0} icon={<Eye         className="w-4 h-4" />} index={1} />
      <MetricCard label="Conversions"      metric={agg.conversions}               decimals={0} icon={<MousePointer className="w-4 h-4" />} index={2} />
      <MetricCard label="Avg. ROAS"        metric={agg.roas}           suffix="x"  decimals={2} icon={<TrendingUp  className="w-4 h-4" />} index={3} />
      <MetricCard label="CPA"              metric={agg.cpa}            prefix="$"  decimals={2} icon={<Target      className="w-4 h-4" />} index={4} invertTrend />
      <MetricCard label="Conversion Rate"  metric={agg.conversionRate} suffix="%"  decimals={2} icon={<Percent     className="w-4 h-4" />} index={5} />
      <MetricCard label="Clicks"           metric={agg.clicks}                    decimals={0} icon={<MousePointer className="w-4 h-4" />} index={6} />
    </div>
  );
}
