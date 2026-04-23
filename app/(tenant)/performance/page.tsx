import { Suspense } from 'react';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchSpendChartData, fetchCampaigns, fetchPlatformMetrics } from '@/features/performance-hub/actions/fetchMetrics';
import { MetricCard } from '@/features/performance-hub/components/MetricCard';
import { SpendChart } from '@/features/performance-hub/components/SpendChart';
import { CampaignTable } from '@/features/performance-hub/components/CampaignTable';
import { TimeRangeFilter } from '@/features/performance-hub/components/TimeRangeFilter';
import { OverviewMetrics } from '@/features/performance-hub/components/OverviewMetrics';
import { PlatformBadge } from '@/components/shared/PlatformBadge';
import { MetricCardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { DollarSign, Eye, MousePointer, TrendingUp, Percent } from 'lucide-react';
import type { TimeRange } from '@/features/performance-hub/actions/fetchMetrics';

interface PageProps {
  searchParams: Promise<{ range?: string; connected?: string }>;
}

export default async function PerformancePage({ searchParams }: PageProps) {
  const { companyId } = await requireTenantContext();
  const params = await searchParams;
  const range: TimeRange = (['daily', 'weekly', 'monthly'] as TimeRange[]).includes(params.range as TimeRange)
    ? (params.range as TimeRange)
    : 'monthly';

  const [chartData, campaigns] = await Promise.all([
    fetchSpendChartData(companyId, range),
    fetchCampaigns(companyId),
  ]);

  return (
    <div className="space-y-6">
      {/* Connected toast */}
      {params.connected && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <span className="font-semibold capitalize">{params.connected}</span>
          <span>successfully connected · syncing last 30 days of data in the background</span>
        </div>
      )}

      {/* KPI Overview with time range selector */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">
            Performance Overview
          </h2>
          <TimeRangeFilter current={range} />
        </div>
        <Suspense fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(7)].map((_, i) => <MetricCardSkeleton key={i} />)}
          </div>
        }>
          <OverviewMetrics companyId={companyId} range={range} />
        </Suspense>
      </div>

      {/* Platform breakdown (also range-filtered) */}
      <Suspense fallback={<ChartSkeleton height={120} />}>
        <PlatformBreakdown companyId={companyId} range={range} />
      </Suspense>

      {/* Spend chart */}
      <SpendChart data={chartData} range={range} />

      {/* Campaign table */}
      <CampaignTable campaigns={campaigns} />
    </div>
  );
}

async function PlatformBreakdown({ companyId, range }: { companyId: string; range: TimeRange }) {
  const metrics = await fetchPlatformMetrics(companyId, range);
  if (!metrics.length) return null;

  return (
    <div>
      <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
        Platform Breakdown
      </h2>
      {metrics.map((m, platformIdx) => (
        <div key={m.platform} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <PlatformBadge platform={m.platform} size="md" />
            <span className="text-xs text-white/30">Performance breakdown</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard label="Spend"       metric={m.spend}       prefix="$" decimals={0} icon={<DollarSign   className="w-3.5 h-3.5" />} index={platformIdx * 5} />
            <MetricCard label="Impressions" metric={m.impressions}            decimals={0} icon={<Eye          className="w-3.5 h-3.5" />} index={platformIdx * 5 + 1} />
            <MetricCard label="Clicks"      metric={m.clicks}                 decimals={0} icon={<MousePointer className="w-3.5 h-3.5" />} index={platformIdx * 5 + 2} />
            <MetricCard label="ROAS"        metric={m.roas}        suffix="x" decimals={2} icon={<TrendingUp   className="w-3.5 h-3.5" />} index={platformIdx * 5 + 3} />
            <MetricCard label="CTR"         metric={m.ctr}         suffix="%" decimals={2} icon={<Percent      className="w-3.5 h-3.5" />} index={platformIdx * 5 + 4} />
          </div>
        </div>
      ))}
    </div>
  );
}
