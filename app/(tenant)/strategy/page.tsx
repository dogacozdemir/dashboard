import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchGeoReports, fetchRoadmap, fetchMarketInsight } from '@/features/strategy-technical/actions/fetchStrategy';
import { GEORankCard } from '@/features/strategy-technical/components/GEORankCard';
import { RoadmapTimeline } from '@/features/strategy-technical/components/RoadmapTimeline';
import { MarketInsightCard, MarketInsightEmpty } from '@/features/strategy-technical/components/MarketInsightCard';

export default async function StrategyPage() {
  const { companyId, tenant } = await requireTenantContext();

  const [reports, roadmap, insight] = await Promise.all([
    fetchGeoReports(companyId),
    fetchRoadmap(companyId),
    fetchMarketInsight(companyId, tenant.name),
  ]);

  return (
    <div className="space-y-6">
      {/* Market Insight */}
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          Market Insight
        </h2>
        {insight ? (
          <MarketInsightCard insight={insight} generatedFor={tenant.name} />
        ) : (
          <MarketInsightEmpty />
        )}
      </div>

      {/* GEO Rankings */}
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          Generative Engine Optimization
        </h2>
        <GEORankCard reports={reports} />
      </div>

      {/* SEO Rankings */}
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          Search Engine Optimization
        </h2>
        <GEORankCard reports={reports} />
      </div>

      {/* Technical Roadmap */}
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          Technical Roadmap
        </h2>
        <RoadmapTimeline items={roadmap} />
      </div>
    </div>
  );
}
