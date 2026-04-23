'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import type { TimeRange } from '../actions/fetchMetrics';

const OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'Daily',   value: 'daily' },
  { label: 'Weekly',  value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

interface TimeRangeFilterProps {
  current: TimeRange;
}

export function TimeRangeFilter({ current }: TimeRangeFilterProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  function select(range: TimeRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-xl bg-white/[0.04] border border-white/[0.06] p-0.5 gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => select(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
            current === opt.value
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'text-white/40 hover:text-white/70'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
