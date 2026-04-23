'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Lock, Globe, Palette, BookOpen, Type, ImageIcon, Package, Shield } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { formatFileSize, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { BrandAsset, BrandAssetType } from '../types';

const typeConfig: Record<BrandAssetType, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}> = {
  logo:            { icon: ImageIcon, color: 'text-indigo-400 bg-indigo-500/10',  label: 'Logo' },
  'brand-book':    { icon: BookOpen,  color: 'text-violet-400 bg-violet-500/10',  label: 'Brand Book' },
  font:            { icon: Type,      color: 'text-cyan-400 bg-cyan-500/10',       label: 'Font' },
  'color-palette': { icon: Palette,   color: 'text-amber-400 bg-amber-500/10',    label: 'Colors' },
  other:           { icon: Package,   color: 'text-white/40 bg-white/[0.06]',     label: 'Asset' },
};

const ALL_TYPES: Array<{ label: string; value: BrandAssetType | 'all' }> = [
  { label: 'All',        value: 'all' },
  { label: 'Logo',       value: 'logo' },
  { label: 'Brand Book', value: 'brand-book' },
  { label: 'Font',       value: 'font' },
  { label: 'Colors',     value: 'color-palette' },
  { label: 'Other',      value: 'other' },
];

interface AssetGridProps {
  assets: BrandAsset[];
}

export function AssetGrid({ assets }: AssetGridProps) {
  const [activeType, setActiveType] = useState<BrandAssetType | 'all'>('all');

  const filtered = activeType === 'all' ? assets : assets.filter((a) => a.type === activeType);

  if (assets.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-4 py-12 text-center border border-dashed border-white/[0.08]" padding="lg">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">Brand Vault is empty</p>
          <p className="text-xs text-white/25 mt-1">Upload logos, brand books, fonts and color palettes above</p>
        </div>
      </GlassCard>
    );
  }

  const availableTypes = ALL_TYPES.filter(
    (t) => t.value === 'all' || assets.some((a) => a.type === t.value)
  );

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {availableTypes.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveType(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              activeType === t.value
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04] border-transparent'
            )}
          >
            {t.label}
            <span className="ml-1.5 text-white/25">
              {t.value === 'all'
                ? assets.length
                : assets.filter((a) => a.type === t.value).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="flex items-center justify-center py-10 text-center" padding="md">
          <p className="text-sm text-white/30">No {activeType} assets found</p>
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
                      <div className="flex items-center gap-3 text-[11px] text-white/30">
                        <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium', config.color)}>
                          {config.label}
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
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/70 hover:bg-white/[0.08] hover:border-indigo-500/30 transition-all opacity-0 group-hover:opacity-100"
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
