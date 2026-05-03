import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import {
  fetchSpendChartData,
  fetchCampaigns,
  fetchPlatformMetrics,
  fetchPlatformComparison,
} from '@/features/performance-hub/actions/fetchMetrics';
import { MetricCard } from '@/features/performance-hub/components/MetricCard';
import { SpendChart } from '@/features/performance-hub/components/SpendChart';
import { CampaignTable } from '@/features/performance-hub/components/CampaignTable';
import { CockpitToolbar } from '@/features/performance-hub/components/CockpitToolbar';
import { CockpitMetricsCrossfade } from '@/features/performance-hub/components/CockpitMetricsCrossfade';
import { OverviewMetrics, type MetricId } from '@/features/performance-hub/components/OverviewMetrics';
import { ConnectedAccountsStrip } from '@/features/performance-hub/components/ConnectedAccountsStrip';
import { ChannelGlassIcon } from '@/features/performance-hub/components/ChannelGlassIcon';
import { PlatformComparisonMatrix } from '@/features/performance-hub/components/PlatformComparisonMatrix';
import { SeoGscMatrix } from '@/features/performance-hub/components/SeoGscMatrix';
import { MetricCardSkeleton, ChartSkeleton } from '@/components/shared/LoadingSkeleton';
import { DollarSign, Eye, MousePointer, TrendingUp, Percent } from 'lucide-react';
import type { TimeRange } from '@/features/performance-hub/actions/fetchMetrics';
import type { Tenant, DashboardGoal } from '@/types/tenant';
import { parseCockpitPlatform, type CockpitPlatform } from '@/features/performance-hub/lib/cockpit-platform';

const METRIC_FOCUS = new Set<string>([
  'spend',
  'revenue',
  'roas',
  'cpa',
  'clicks',
  'ctr',
  'impressions',
  'conversionRate',
]);

interface PageProps {
  searchParams: Promise<{ range?: string; connected?: string; focus?: string; platform?: string }>;
}

export default async function PerformancePage({ searchParams }: PageProps) {
  const { companyId, tenant: tenantCtx } = await requireTenantContext();
  const tenant = tenantCtx as Tenant;
  const dashboardGoal = (tenant.dashboard_goal as DashboardGoal | undefined) ?? null;
  const params = await searchParams;
  const tPerf = await getTranslations('Performance');

  const spotlightMetric =
    params.focus && METRIC_FOCUS.has(params.focus) ? (params.focus as MetricId) : null;

  const range: TimeRange = (['daily', 'weekly', 'monthly'] as TimeRange[]).includes(params.range as TimeRange)
    ? (params.range as TimeRange)
    : 'monthly';

  const cockpit = parseCockpitPlatform(params.platform);

  const [chartData, campaigns, comparisonRows] = await Promise.all([
    fetchSpendChartData(companyId, range, cockpit),
    fetchCampaigns(companyId, cockpit),
    cockpit === 'all' ? fetchPlatformComparison(companyId, range, cockpit) : Promise.resolve([]),
  ]);

  const paidSurface = cockpit !== 'seo';

  return (
    <div className="cockpit-liquid-scope space-y-6">
      {params.connected && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <span className="font-medium">{tPerf('performancePage.connectedBanner', { platform: params.connected })}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">
          {tPerf('performancePage.overviewHeading')}
        </h2>
        <CockpitToolbar currentRange={range} currentPlatform={cockpit} showMonoReportExport />
      </div>

      <CockpitMetricsCrossfade cockpit={cockpit} range={range}>
        <div className="flex w-full min-w-0 flex-col gap-8">
          <Suspense
            fallback={
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <MetricCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <OverviewMetrics
              companyId={companyId}
              range={range}
              dashboardGoal={dashboardGoal}
              spotlightMetric={spotlightMetric}
              cockpitPlatform={cockpit}
            />
          </Suspense>

          <Suspense fallback={null}>
            <ConnectedAccountsStrip companyId={companyId} />
          </Suspense>

          {cockpit === 'all' && comparisonRows.length > 0 ? (
            <PlatformComparisonMatrix rows={comparisonRows} />
          ) : null}

          {paidSurface ? (
            <Suspense fallback={<ChartSkeleton height={120} />}>
              <PlatformBreakdown companyId={companyId} range={range} cockpit={cockpit} />
            </Suspense>
          ) : null}

          {paidSurface ? <SpendChart data={chartData} range={range} /> : null}

          {paidSurface ? <CampaignTable campaigns={campaigns} /> : null}
        </div>
      </CockpitMetricsCrossfade>

      {cockpit === 'all' || cockpit === 'seo' ? (
        <Suspense fallback={<ChartSkeleton height={200} />}>
          <SeoGscMatrix companyId={companyId} tenantBrandName={tenant.name ?? null} />
        </Suspense>
      ) : null}
    </div>
  );
}

async function PlatformBreakdown({
  companyId,
  range,
  cockpit,
}: {
  companyId: string;
  range: TimeRange;
  cockpit: CockpitPlatform;
}) {
  if (cockpit === 'seo') return null;

  const metrics = await fetchPlatformMetrics(companyId, range, cockpit);
  const tPerf = await getTranslations('Performance');
  if (!metrics.length) return null;

  return (
    <div>
      <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
        {tPerf('performancePage.platformBreakdown')}
      </h2>
      {metrics.map((m, platformIdx) => (
        <div key={m.platform} className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <ChannelGlassIcon platform={m.platform} />
            <div>
              <span className="text-sm font-medium text-white/80 capitalize">{m.platform}</span>
              <p className="text-xs text-white/30">{tPerf('performancePage.channelCaption')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard label={tPerf('performancePage.metricSpend')} metric={m.spend} prefix="$" decimals={0} icon={<DollarSign className="w-3.5 h-3.5" />} index={platformIdx * 5} trendSemantics="growth" />
            <MetricCard label={tPerf('performancePage.metricImpressions')} metric={m.impressions} decimals={0} icon={<Eye className="w-3.5 h-3.5" />} index={platformIdx * 5 + 1} trendSemantics="growth" />
            <MetricCard label={tPerf('performancePage.metricClicks')} metric={m.clicks} decimals={0} icon={<MousePointer className="w-3.5 h-3.5" />} index={platformIdx * 5 + 2} trendSemantics="growth" />
            <MetricCard label={tPerf('performancePage.metricRoas')} metric={m.roas} suffix="x" decimals={2} icon={<TrendingUp className="w-3.5 h-3.5" />} index={platformIdx * 5 + 3} trendSemantics="efficiency" />
            <MetricCard label={tPerf('performancePage.metricCtr')} metric={m.ctr} suffix="%" decimals={2} icon={<Percent className="w-3.5 h-3.5" />} index={platformIdx * 5 + 4} trendSemantics="efficiency" />
          </div>
        </div>
      ))}
    </div>
  );
}
