'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Lock, Globe, Palette, BookOpen, Type, ImageIcon, Package, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { formatFileSize, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { BrandAsset, BrandAssetType } from '../types';

interface AssetGridProps {
  assets: BrandAsset[];
}

export function AssetGrid({ assets }: AssetGridProps) {
  const t = useTranslations('Features.BrandVault');
  const [activeType, setActiveType] = useState<BrandAssetType | 'all'>('all');

  const typeConfig: Record<BrandAssetType, {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    labelKey: string;
  }> = {
    logo:            { icon: ImageIcon, color: 'text-[#b48dc8] bg-[#9c70b2]/12',     labelKey: 'typeLabelLogo' },
    'brand-book':    { icon: BookOpen,  color: 'text-amber-300/90 bg-[#bea042]/12', labelKey: 'typeLabelBrandBook' },
    font:            { icon: Type,      color: 'text-cyan-300/90 bg-cyan-500/10',     labelKey: 'typeLabelFont' },
    'color-palette': { icon: Palette,   color: 'text-[#bea042] bg-[#bea042]/10',      labelKey: 'typeLabelPalette' },
    other:           { icon: Package,   color: 'text-white/45 bg-white/[0.06]',     labelKey: 'typeLabelOther' },
  };

  const TAB_ITEMS: Array<{ value: BrandAssetType | 'all'; labelKey: string }> = [
    { value: 'all', labelKey: 'tabAll' },
    { value: 'logo', labelKey: 'typeLabelLogo' },
    { value: 'brand-book', labelKey: 'typeLabelBrandBook' },
    { value: 'font', labelKey: 'typeLabelFont' },
    { value: 'color-palette', labelKey: 'typeLabelPalette' },
    { value: 'other', labelKey: 'typeLabelOther' },
  ];

  const filtered = activeType === 'all' ? assets : assets.filter((a) => a.type === activeType);

  if (assets.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-4 py-12 text-center border border-dashed border-white/[0.08]" padding="lg">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(156,112,178,0.12)', border: '1px solid rgba(156,112,178,0.22)' }}>
          <Shield className="w-5 h-5 text-[#b48dc8]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">{t('emptyTitle')}</p>
          <p className="text-xs text-white/25 mt-1 line-clamp-3">{t('emptySubtitle')}</p>
        </div>
      </GlassCard>
    );
  }

  const availableTypes = TAB_ITEMS.filter(
    (tab) => tab.value === 'all' || assets.some((a) => a.type === tab.value)
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {availableTypes.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveType(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border max-w-[11rem]',
              activeType === tab.value
                ? 'text-white/88 border-[#bea042]/35'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04] border-transparent',
            )}
            style={
              activeType === tab.value
                ? { background: 'linear-gradient(135deg, rgba(156,112,178,0.2), rgba(190,160,66,0.1))' }
                : undefined
            }
          >
            <span className="truncate">{t(tab.labelKey)}</span>
            <span className="ml-1.5 text-white/25">
              {tab.value === 'all'
                ? assets.length
                : assets.filter((a) => a.type === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="flex items-center justify-center py-10 text-center" padding="md">
          <p className="text-sm text-white/30">{t('filteredEmpty')}</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((asset, i) => {
            const config = typeConfig[asset.type];
            const Icon   = config.icon;

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard padding="none" hover className="overflow-hidden group">
                  <div className="flex items-center gap-4 p-5">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', config.color)}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-white/80 truncate">{asset.name}</p>
                        {asset.isPublic ? (
                          <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-3 h-3 text-white/25 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-white/30 flex-wrap">
                        <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate max-w-[120px]', config.color)}>
                          {t(config.labelKey)}
                        </span>
                        {asset.fileSize != null && <span>{formatFileSize(asset.fileSize)}</span>}
                        <span>{formatDate(asset.createdAt)}</span>
                      </div>
                    </div>

                    {asset.url ? (
                      <a
                        href={asset.url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/70 hover:bg-white/[0.08] hover:border-[#bea042]/35 transition-all opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    ) : (
                      <div className="w-9 h-9 opacity-0 group-hover:opacity-40 flex items-center justify-center">
                        <Download className="w-4 h-4 text-white/20" />
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
