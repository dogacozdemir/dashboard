'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { PlatformBadge } from '@/components/shared/PlatformBadge';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { CampaignGoalBars } from '@/features/gamification/components/CampaignGoalBars';
import type { CampaignRow } from '../types';

interface CampaignTableProps {
  campaigns: CampaignRow[];
}

const statusStyles: Record<CampaignRow['status'], string> = {
  active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  paused:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-white/5 text-white/40 border-white/10',
};

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const t = useTranslations('Performance.campaignTable');
  const headers = [
    t('colCampaign'),
    t('colPlatform'),
    t('colSpend'),
    t('colImpressions'),
    t('colClicks'),
    t('colConv'),
    t('colRoas'),
    t('colStatus'),
  ] as const;

  return (
    <GlassCard padding="none" className="bento-card">
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white/80">{t('title')}</h3>
        <p className="text-xs text-white/30 mt-0.5">{t('subtitle')}</p>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-6">
          <p className="text-sm text-white/30">{t('emptyTitle')}</p>
          <p className="text-xs text-white/20">{t('emptySubtitle')}</p>
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-[background-color] duration-300 ease-out"
              >
                <td className="px-6 py-4 max-w-[220px]">
                  <p className="text-sm text-white/80 font-medium truncate">{row.campaignName}</p>
                  <CampaignGoalBars
                    impressions={row.impressions}
                    clicks={row.clicks}
                    spend={row.spend}
                    goals={{
                      goalImpressions: row.goalImpressions,
                      goalClicks:      row.goalClicks,
                      goalSpend:       row.goalSpend,
                    }}
                  />
                </td>
                <td className="px-6 py-4">
                  <PlatformBadge platform={row.platform} />
                </td>
                <td className="px-6 py-4 text-sm text-white/70 tabular-nums">
                  {formatCurrency(row.spend)}
                </td>
                <td className="px-6 py-4 text-sm text-white/70 tabular-nums">
                  {formatNumber(row.impressions)}
                </td>
                <td className="px-6 py-4 text-sm text-white/70 tabular-nums">
                  {formatNumber(row.clicks)}
                </td>
                <td className="px-6 py-4 text-sm text-white/70 tabular-nums">
                  {formatNumber(row.conversions)}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-emerald-400 tabular-nums">
                  {row.roas.toFixed(1)}x
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize',
                    statusStyles[row.status]
                  )}>
                    {row.status === 'active'
                      ? t('statusActive')
                      : row.status === 'paused'
                        ? t('statusPaused')
                        : t('statusCompleted')}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </GlassCard>
  );
}
