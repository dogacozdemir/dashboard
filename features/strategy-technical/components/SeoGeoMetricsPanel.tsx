import { getTranslations } from 'next-intl/server';
import { Activity, AlertTriangle, Eye, MapPin, MousePointerClick, Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import {
  BentoBlueprintSlot,
  BlueprintBars,
  BlueprintRankLadder,
  BlueprintRatioArc,
  BlueprintSparkTrend,
} from '@/components/shared/BentoBlueprintEmpty';
import { MetricCard } from '@/features/performance-hub/components/MetricCard';
import type { SeoGeoDashboardData } from '../types';
import { CwvRings } from './CwvRings';
import { GeoVisibilityGauge } from './GeoVisibilityGauge';
import { GeoKeywordLiquidTable } from './GeoKeywordLiquidTable';

interface SeoGeoMetricsPanelProps {
  data: SeoGeoDashboardData;
}

export async function SeoGeoMetricsPanel({ data }: SeoGeoMetricsPanelProps) {
  const t = await getTranslations('Features.StrategyTechnical.seoGeo');
  const { seo, geo, cwv, errorCount, aiInsight, geoStrategy, geoAiKeywords } = data;

  const visibilityScore =
    geoStrategy?.overallVisibilityScore ??
    (geoAiKeywords.length > 0
      ? Math.round(geoAiKeywords.reduce((s, k) => s + k.visibilityScore, 0) / geoAiKeywords.length)
      : 0);

  const hasGeoScore = Boolean(geoStrategy) || geoAiKeywords.length > 0;

  const isColdOnboarding =
    seo.impressions.current === 0 &&
    seo.visits.current === 0 &&
    geo.trackedKeywords === 0 &&
    !geoStrategy &&
    geoAiKeywords.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          {t('searchVisibilityHeading')}
        </h2>
        {isColdOnboarding ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BentoBlueprintSlot title={t('coldImpressionsTitle')} caption={t('coldImpressionsCaption')}>
              <BlueprintSparkTrend />
            </BentoBlueprintSlot>
            <BentoBlueprintSlot title={t('coldVisitsTitle')} caption={t('coldVisitsCaption')}>
              <BlueprintBars />
            </BentoBlueprintSlot>
            <BentoBlueprintSlot title={t('coldCtrTitle')} caption={t('coldCtrCaption')}>
              <BlueprintRatioArc />
            </BentoBlueprintSlot>
            <BentoBlueprintSlot title={t('coldPositionTitle')} caption={t('coldPositionCaption')}>
              <BlueprintRankLadder />
            </BentoBlueprintSlot>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t('metricImpressions')}
              metric={seo.impressions}
              decimals={0}
              icon={<Eye className="w-4 h-4" />}
              index={0}
              trendSemantics="growth"
            />
            <MetricCard
              label={t('metricVisits')}
              metric={seo.visits}
              decimals={0}
              icon={<MousePointerClick className="w-4 h-4" />}
              index={1}
              trendSemantics="growth"
            />
            <MetricCard
              label={t('metricCtr')}
              metric={seo.ctr}
              suffix="%"
              decimals={2}
              icon={<Activity className="w-4 h-4" />}
              index={2}
              trendSemantics="efficiency"
            />
            <MetricCard
              label={t('metricAvgPosition')}
              metric={seo.avgPosition}
              decimals={1}
              icon={<MapPin className="w-4 h-4" />}
              index={3}
              trendSemantics="cost"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GeoVisibilityGauge
          score={hasGeoScore ? visibilityScore : 0}
          subtitle={
            geoStrategy?.sentimentAndCitations?.slice(0, 220) ||
            (hasGeoScore ? t('geoSubtitleFallback') : undefined)
          }
        />
        {geoStrategy ? (
          <GlassCard padding="lg" className="bento-card flex flex-col justify-center">
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em] mb-2">
              {t('geoGapHeading')}
            </p>
            <p className="text-sm text-white/55 leading-relaxed">{geoStrategy.geoGapAnalysis}</p>
            <p className="text-[10px] font-semibold text-[#bea042]/80 uppercase tracking-[0.12em] mt-5 mb-2">
              {t('actionPlanHeading')}
            </p>
            <p className="text-xs text-white/45 leading-relaxed whitespace-pre-line">{geoStrategy.globalActionPlan}</p>
          </GlassCard>
        ) : (
          <GlassCard padding="lg" className="bento-card border border-dashed border-white/[0.08] flex items-center">
            <p className="text-sm text-white/40 leading-relaxed">{t('geoInactiveBody')}</p>
          </GlassCard>
        )}
      </div>

      <GeoKeywordLiquidTable rows={geoAiKeywords} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard padding="md" className="bento-card md:col-span-1">
          <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em] mb-2">
            {t('serviceVisibilityHeading')}
          </p>
          <p className="text-3xl font-bold gradient-text-static tabular-nums">
            {geo.serviceVisibilityPct.toFixed(0)}%
          </p>
          <p className="text-xs text-white/30 mt-1">{t('serviceVisibilitySub')}</p>
        </GlassCard>
        <GlassCard padding="md" className="bento-card md:col-span-1">
          <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em] mb-2">
            {t('avgGeoRankHeading')}
          </p>
          <p className="text-3xl font-bold text-white/90 tabular-nums">
            {geo.avgPosition != null ? `#${geo.avgPosition.toFixed(1)}` : '—'}
          </p>
          <p className="text-xs text-white/30 mt-1">{t('keywordsAcrossEngines', { count: geo.trackedKeywords })}</p>
        </GlassCard>
        <GlassCard padding="md" className="bento-card md:col-span-1 border-amber-500/15">
          <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400/80" />
            {t('errorSignalsHeading')}
          </p>
          <p className="text-3xl font-bold text-amber-400/95 tabular-nums">{errorCount}</p>
          <p className="text-xs text-white/30 mt-1">{t('technicalLogsHint')}</p>
        </GlassCard>
      </div>

      {cwv ? (
        <CwvRings
          lcp={cwv.lcp}
          fid={cwv.fid}
          cls={cwv.cls}
          lcpRaw={cwv.lcpRaw}
          fidRaw={cwv.fidRaw}
          clsRaw={cwv.clsRaw}
        />
      ) : (
        <GlassCard padding="lg" className="bento-card border border-dashed border-white/[0.1]">
          <h3 className="text-sm font-semibold text-white/70">{t('cwvEmptyTitle')}</h3>
          <p className="text-xs text-white/35 mt-2 leading-relaxed">{t('cwvEmptyBody')}</p>
          <div className="mt-4 opacity-80">
            <BlueprintRatioArc className="h-16" />
          </div>
        </GlassCard>
      )}

      {aiInsight && (
        <GlassCard padding="lg" className="bento-card" glow="violet">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#bea042]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/85">{t('seoLogInsightHeading')}</h3>
              <p className="text-xs text-white/45 mt-1 leading-relaxed">{aiInsight}</p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
