import { fetchExecutiveTrend, type TimeRange } from '../actions/fetchMetrics';
import { ExecutiveTrendChart } from './ExecutiveTrendChart';
import type { CockpitPlatform } from '../lib/cockpit-platform';
import { cockpitShowsExecutiveTrend } from '../lib/cockpit-platform';

export async function ExecutiveTrendSection({
  companyId,
  range,
  cockpit,
}: {
  companyId: string;
  range: TimeRange;
  cockpit: CockpitPlatform;
}) {
  if (!cockpitShowsExecutiveTrend(cockpit)) return null;

  const data = await fetchExecutiveTrend(companyId, range, cockpit);
  if (!data.length) return null;

  return <ExecutiveTrendChart data={data} />;
}
