import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import {
  fetchAggregateMetrics,
  fetchConnectedAdAccounts,
} from '../actions/fetchMetrics';
import { MetricCard } from './MetricCard';
import {
  DollarSign,
  TrendingUp,
  MousePointer,
  Eye,
  Percent,
  Target,
  Banknote,
} from 'lucide-react';
import { DataDisconnectedCard } from '@/components/shared/DataDisconnectedCard';
import {
  BentoBlueprintSlot,
  BlueprintBars,
  BlueprintSparkTrend,
} from '@/components/shared/BentoBlueprintEmpty';
import type { TimeRange } from '../actions/fetchMetrics';
import type { DashboardGoal } from '@/types/tenant';
import type { CockpitPlatform } from '../lib/cockpit-platform';
import { AdPlatformDock } from './AdPlatformDock';

export type MetricId =
  | 'spend'
  | 'revenue'
  | 'roas'
  | 'cpa'
  | 'clicks'
  | 'ctr'
  | 'impressions'
  | 'conversionRate';

interface OverviewMetricsProps {
  companyId: string;
  range?: TimeRange;
  /** Magic Onboarding: reorder metrics and spotlight the top KPI. */
  dashboardGoal?: DashboardGoal | null;
  /** Command Center: extra spotlight on a metric id (e.g. roas, spend). */
  spotlightMetric?: MetricId | null;
  /** Unified Cockpit URL filter — scopes aggregates to one paid channel or organic SEO. */
  cockpitPlatform?: CockpitPlatform;
}

const DEFAULT_ORDER: MetricId[] = [
  'spend',
  'revenue',
  'roas',
  'cpa',
  'clicks',
  'ctr',
  'impressions',
  'conversionRate',
];

const GOAL_ORDER: Record<DashboardGoal, MetricId[]> = {
  sales: ['roas', 'revenue', 'cpa', 'conversionRate', 'clicks', 'ctr', 'spend', 'impressions'],
  awareness: ['impressions', 'ctr', 'clicks', 'spend', 'revenue', 'roas', 'cpa', 'conversionRate'],
  cost: ['cpa', 'spend', 'roas', 'ctr', 'clicks', 'impressions', 'revenue', 'conversionRate'],
};

export async function OverviewMetrics({
  companyId,
  range = 'monthly',
  dashboardGoal = null,
  spotlightMetric = null,
  cockpitPlatform = 'all',
}: OverviewMetricsProps) {
  const t = await getTranslations('Performance');
  const [agg, connected] = await Promise.all([
    fetchAggregateMetrics(companyId, range, cockpitPlatform),
    fetchConnectedAdAccounts(companyId),
  ]);

  const order = dashboardGoal ? GOAL_ORDER[dashboardGoal] : DEFAULT_ORDER;

  const cards: Record<
    MetricId,
    {
      label: string;
      metric: (typeof agg)['spend'];
      prefix?: string;
      suffix?: string;
      decimals: number;
      icon: ReactNode;
      trendSemantics: 'growth' | 'cost' | 'efficiency';
    }
  > = {
    spend: {
      label: t('metrics.totalSpend'),
      metric: agg.spend,
      prefix: '$',
      decimals: 0,
      icon: <DollarSign className="w-4 h-4" />,
      trendSemantics: 'growth',
    },
    revenue: {
      label: t('metrics.revenue'),
      metric: agg.revenue,
      prefix: '$',
      decimals: 0,
      icon: <Banknote className="w-4 h-4" />,
      trendSemantics: 'growth',
    },
    roas: {
      label: t('metrics.avgRoas'),
      metric: agg.roas,
      suffix: 'x',
      decimals: 2,
      icon: <TrendingUp className="w-4 h-4" />,
      trendSemantics: 'efficiency',
    },
    cpa: {
      label: t('metrics.cpa'),
      metric: agg.cpa,
      prefix: '$',
      decimals: 2,
      icon: <Target className="w-4 h-4" />,
      trendSemantics: 'cost',
    },
    clicks: {
      label: t('metrics.clicks'),
      metric: agg.clicks,
      decimals: 0,
      icon: <MousePointer className="w-4 h-4" />,
      trendSemantics: 'growth',
    },
    ctr: {
      label: t('metrics.ctr'),
      metric: agg.ctr,
      suffix: '%',
      decimals: 2,
      icon: <Percent className="w-4 h-4" />,
      trendSemantics: 'efficiency',
    },
    impressions: {
      label: t('metrics.impressions'),
      metric: agg.impressions,
      decimals: 0,
      icon: <Eye className="w-4 h-4" />,
      trendSemantics: 'growth',
    },
    conversionRate: {
      label: t('metrics.conversionRate'),
      metric: agg.conversionRate,
      suffix: '%',
      decimals: 2,
      icon: <Percent className="w-4 h-4" />,
      trendSemantics: 'efficiency',
    },
  };

  const metricGrid = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {order.map((id, i) => {
        const c = cards[id];
        const spotlight =
          Boolean(spotlightMetric && id === spotlightMetric) ||
          Boolean(!spotlightMetric && dashboardGoal && i === 0);

        return (
          <MetricCard
            key={id}
            label={c.label}
            metric={c.metric}
            prefix={c.prefix}
            suffix={c.suffix}
            decimals={c.decimals}
            icon={c.icon}
            index={i}
            spotlight={spotlight}
            trendSemantics={c.trendSemantics}
          />
        );
      })}
    </div>
  );

  if (!agg.hasData && connected.length === 0) {
    return (
      <div className="space-y-4">
        <DataDisconnectedCard
          title={t('connectedAccounts.disconnectTitle')}
          description={t('disconnected.zeroAccountsDescription')}
          actions={<AdPlatformDock accounts={[]} />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 opacity-90">
          <BentoBlueprintSlot title={t('blueprint.spendCurveTitle')} caption={t('blueprint.spendCurveCaption')}>
            <BlueprintSparkTrend />
          </BentoBlueprintSlot>
          <BentoBlueprintSlot title={t('blueprint.revenueRoasTitle')} caption={t('blueprint.revenueRoasCaption')}>
            <BlueprintBars />
          </BentoBlueprintSlot>
          <BentoBlueprintSlot title={t('blueprint.clickEfficiencyTitle')} caption={t('blueprint.clickEfficiencyCaption')}>
            <BlueprintSparkTrend />
          </BentoBlueprintSlot>
          <BentoBlueprintSlot title={t('blueprint.campaignIntensityTitle')} caption={t('blueprint.campaignIntensityCaption')}>
            <BlueprintBars />
          </BentoBlueprintSlot>
        </div>
      </div>
    );
  }

  if (!agg.hasData && connected.length > 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[11px] text-white/55 leading-relaxed">{t('syncPendingBanner')}</p>
        </div>
        {metricGrid}
      </div>
    );
  }

  return metricGrid;
}
