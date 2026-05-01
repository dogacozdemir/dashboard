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

  const [roadmap, insight, seoGeo] = await Promise.all([
    fetchRoadmap(companyId),
    fetchMarketInsight(companyId, tenant.name),
    fetchSeoGeoDashboard(companyId),
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
        {insight ? (
          <MarketInsightCard insight={insight} generatedFor={tenant.name} />
        ) : (
          <MarketInsightEmpty />
        )}
      </div>

      <SeoGeoMetricsPanel data={seoGeo} />

      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          {t('sectionGeo')}
        </h2>
        <GEORankCard reports={rankCardReports} />
      </div>

      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          {t('sectionRoadmap')}
        </h2>
        <RoadmapTimeline items={roadmap} />
      </div>
    </div>
  );
}
