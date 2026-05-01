'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { ChannelGlassIcon } from './ChannelGlassIcon';
import type { PlatformComparisonRow } from '../actions/fetchMetrics';
import type { Platform } from '../types';

export function PlatformComparisonMatrix({ rows }: { rows: PlatformComparisonRow[] }) {
  const t = useTranslations('Performance.cockpit.comparison');

  if (!rows.length) return null;

  return (
    <motion.div layout className="space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">{t('title')}</h2>
        <p className="text-[11px] text-white/35 mt-1">{t('subtitle')}</p>
      </div>

      <GlassCard
        padding="none"
        className="bento-card rounded-[2rem] border-white/10 backdrop-blur-3xl saturate-200 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/35 uppercase tracking-wider">
                  {t('colPlatform')}
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider">
                  {t('colSpend')}
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider">
                  {t('colRevenue')}
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider">
                  {t('colRoas')}
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider">
                  {t('colCpa')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr
                  key={r.platform}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <ChannelGlassIcon platform={r.platform as Platform} />
                      <span className="text-sm font-medium text-white/82 capitalize">{r.platform}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-sm text-white/72 tabular-nums">
                    ${r.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-5 py-4 text-right text-sm text-white/72 tabular-nums">
                    ${r.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-semibold text-emerald-400/95 tabular-nums">
                    {r.roas.toFixed(2)}x
                  </td>
                  <td className="px-5 py-4 text-right text-sm text-white/72 tabular-nums">
                    ${r.cpa.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </motion.div>
  );
}
