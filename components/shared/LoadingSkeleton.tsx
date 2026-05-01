import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-lg bg-white/[0.06] relative overflow-hidden animate-shimmer',
        className
      )}
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="glass glow-inset bento-card p-6 space-y-3 relative overflow-hidden">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="glass glow-inset bento-card p-6 relative overflow-hidden">
      <Skeleton className="h-4 w-32 mb-6" />
      <Skeleton style={{ height }} className="w-full rounded-2xl" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass glow-inset bento-card p-6 space-y-3 relative overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
}
