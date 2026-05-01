'use client';

import { motion } from 'framer-motion';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';
import type { GeoAiKeywordRow } from '../types';

interface GeoKeywordLiquidTableProps {
  rows: GeoAiKeywordRow[];
}

export function GeoKeywordLiquidTable({ rows }: GeoKeywordLiquidTableProps) {
  if (!rows.length) {
    return (
      <GlassCard padding="lg" className="bento-card border border-dashed border-white/[0.08]">
        <h3 className="text-sm font-semibold text-white/70">GEO keyword intelligence</h3>
        <p className="text-xs text-white/35 mt-2 leading-relaxed">
          Run a Google OAuth sync with Search Console, then trigger the GEO simulator (cron or pipeline) to populate
          DeepSeek visibility scores and action plans per query.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="none" className="bento-card overflow-hidden">
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white/85">GEO keyword performance</h3>
        <p className="text-xs text-white/30 mt-0.5">DeepSeek · simulated LLM visibility vs GSC context</p>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Query', 'AI score', 'GSC imps', 'Steps'].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={`${row.keyword}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22, delay: i * 0.035 }}
                className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-[background-color] duration-300 ease-out"
              >
                <td className="px-6 py-3.5 max-w-[200px]">
                  <p className="text-sm font-medium text-white/85 truncate" title={row.keyword}>
                    {row.keyword}
                  </p>
                </td>
                <td className="px-6 py-3.5">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-xl text-xs font-bold tabular-nums border',
                      row.visibilityScore >= 70
                        ? 'text-emerald-300/95 border-emerald-500/25 bg-emerald-500/10'
                        : row.visibilityScore >= 40
                          ? 'text-amber-300/95 border-amber-500/25 bg-amber-500/10'
                          : 'text-red-300/90 border-red-500/20 bg-red-500/10',
                    )}
                  >
                    {row.visibilityScore}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-sm text-white/50 tabular-nums">
                  {row.gscImpressions != null ? row.gscImpressions.toLocaleString() : '—'}
                </td>
                <td className="px-6 py-3.5 text-xs text-white/45 leading-relaxed max-w-md">
                  {row.actionableSteps}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
