import { MetricCardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton';

/**
 * Streaming loading state shown while any tenant route segment suspends.
 * Uses the same glass/bento grid language as the real pages.
 */
export default function TenantLoading() {
  return (
    <div className="space-y-6 animate-pulse-subtle">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      {/* Chart + table */}
      <ChartSkeleton height={220} />
      <TableSkeleton rows={6} />
    </div>
  );
}
