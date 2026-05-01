'use client';

import {
  BentoBlueprintSlot,
  BlueprintBars,
  BlueprintRankLadder,
  BlueprintRatioArc,
  BlueprintSparkTrend,
} from '@/components/shared/BentoBlueprintEmpty';
import { useTranslations } from 'next-intl';

export function StrategySeoSkeleton() {
  const t = useTranslations('Features.Strategy');

  return (
    <div className="space-y-8">
      <div className="glass gpu-glass-promote glow-inset bento-card h-36 rounded-[2rem] border border-dashed border-white/[0.08] animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoBlueprintSlot title={t('skeletonLoading')} caption={t('skeletonVisibility')}>
          <BlueprintSparkTrend />
        </BentoBlueprintSlot>
        <BentoBlueprintSlot title={t('skeletonLoading')} caption={t('skeletonTraffic')}>
          <BlueprintBars />
        </BentoBlueprintSlot>
        <BentoBlueprintSlot title={t('skeletonLoading')} caption={t('skeletonRatio')}>
          <BlueprintRatioArc />
        </BentoBlueprintSlot>
        <BentoBlueprintSlot title={t('skeletonLoading')} caption={t('skeletonRank')}>
          <BlueprintRankLadder />
        </BentoBlueprintSlot>
      </div>
      <div className="glass gpu-glass-promote glow-inset bento-card h-48 rounded-[2rem] border border-dashed border-white/[0.08] animate-pulse" />
      <div className="glass gpu-glass-promote glow-inset bento-card h-64 rounded-[2rem] border border-dashed border-white/[0.08] animate-pulse" />
    </div>
  );
}
