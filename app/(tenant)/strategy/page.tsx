import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchRoadmap, fetchMarketInsight, fetchSeoGeoDashboard } from '@/features/strategy-technical/actions/fetchStrategy';
import { GEORankCard } from '@/features/strategy-technical/components/GEORankCard';
import { RoadmapTimeline } from '@/features/strategy-technical/components/RoadmapTimeline';
import { MarketInsightCard, MarketInsightEmpty } from '@/features/strategy-technical/components/MarketInsightCard';
import { SeoGeoMetricsPanel } from '@/features/strategy-technical/components/SeoGeoMetricsPanel';
import { AiStrategyInsightCard } from '@/features/strategy-technical/components/AiStrategyInsightCard';
import { StrategySeoSkeleton } from '@/features/strategy-technical/components/StrategySeoSkeleton';
import { CompetitorPanel } from '@/features/competitors/components/CompetitorPanel';
import { fetchCompetitors, canManageCompetitors } from '@/features/competitors/actions/competitorActions';

export default function StrategyPage() {
  return (
    <Suspense fallback={<StrategySeoSkeleton />}>
      <StrategyPageInner />
    </Suspense>
  );
}

async function StrategyPageInner() {
  const { companyId, tenant } = await requireTenantContext();
  const t = await getTranslations('Features.StrategyPage');

  // Everything here is DB-only and fast; the market insight (a DeepSeek call
  // that can take several seconds on a cache miss) is streamed separately so it
  // never blocks the rest of the page from painting.
  const [roadmap, seoGeo, competitors, canManage] = await Promise.all([
    fetchRoadmap(companyId),
    fetchSeoGeoDashboard(companyId),
    fetchCompetitors(companyId),
    canManageCompetitors(),
  ]);

  const rankCardReports = seoGeo.geoReports.filter((r) => r.metricSource !== 'geo_ai');

  return (
    <div className="space-y-8">
      {seoGeo.geoStrategy && (
        <div>
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
            {t('sectionStrategy')}
          </h2>
          <AiStrategyInsightCard strategy={seoGeo.geoStrategy} />
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          {t('sectionMarket')}
        </h2>
        <Suspense fallback={<MarketInsightLoading />}>
          <MarketInsightSection companyId={companyId} tenantName={tenant.name} />
        </Suspense>
      </div>

      <SeoGeoMetricsPanel data={seoGeo} />

      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          {t('sectionGeo')}
        </h2>
        <GEORankCard reports={rankCardReports} />
      </div>

      <CompetitorPanel companyId={companyId} initial={competitors} canManage={canManage} />

      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          {t('sectionRoadmap')}
        </h2>
        <RoadmapTimeline items={roadmap} />
      </div>
    </div>
  );
}

/** Streamed on its own so the AI call doesn't gate the whole page. */
async function MarketInsightSection({
  companyId,
  tenantName,
}: {
  companyId: string;
  tenantName: string;
}) {
  const insight = await fetchMarketInsight(companyId, tenantName);
  return insight ? (
    <MarketInsightCard insight={insight} generatedFor={tenantName} />
  ) : (
    <MarketInsightEmpty />
  );
}

function MarketInsightLoading() {
  return (
    <div className="glass gpu-glass-promote glow-inset bento-card h-48 rounded-[2rem] border border-dashed border-white/[0.08] animate-pulse" />
  );
}
