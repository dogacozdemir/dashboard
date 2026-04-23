'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Clapperboard } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { ApprovalBadge } from './ApprovalBadge';
import { RevisionThread } from './RevisionThread';
import { formatRelativeTime } from '@/lib/utils/format';
import type { CreativeAsset, AssetStatus } from '../types';

interface MediaGridProps {
  assets: CreativeAsset[];
  companyId: string;
}

const statusFilter: { label: string; value: AssetStatus | 'all' }[] = [
  { label: 'All',      value: 'all' },
  { label: 'Pending',  value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Revision', value: 'revision' },
];

export function MediaGrid({ assets: initialAssets, companyId }: MediaGridProps) {
  const [assets, setAssets] = useState<CreativeAsset[]>(initialAssets);
  const [filter, setFilter] = useState<AssetStatus | 'all'>('all');
  const [selectedAsset, setSelectedAsset] = useState<CreativeAsset | null>(null);

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.status === filter);

  function handleStatusChange(assetId: string, newStatus: CreativeAsset['status']) {
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, status: newStatus } : a))
    );
    if (selectedAsset?.id === assetId) {
      setSelectedAsset((prev) => prev ? { ...prev, status: newStatus } : null);
    }
  }

  if (assets.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-4 py-12 text-center border border-dashed border-white/[0.08]" padding="lg">
        <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center">
          <Clapperboard className="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">No creative assets yet</p>
          <p className="text-xs text-white/25 mt-1">Upload your first asset using the panel above</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {statusFilter.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-white/25">
              {f.value === 'all' ? assets.length : assets.filter((a) => a.status === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((asset, i) => (
            <motion.div
              key={asset.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.3) }}
              role="button"
              tabIndex={0}
              aria-label={`Review ${asset.title} — ${asset.status}`}
              onClick={() => setSelectedAsset(asset)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedAsset(asset);
                }
              }}
              className="cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-2xl"
            >
              <GlassCard padding="none" hover className="overflow-hidden">
                {/* Thumbnail area */}
                <div className="relative h-40 bg-gradient-to-br from-white/[0.03] to-white/[0.01] flex items-center justify-center border-b border-white/[0.06] overflow-hidden">
                  {asset.type === 'video' ? (
                    <video
                      src={asset.url}
                      className="object-cover w-full h-full"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (asset.thumbnailUrl || asset.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.thumbnailUrl ?? asset.url} alt={asset.title} className="object-cover w-full h-full" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Video className="w-5 h-5 text-cyan-400" />
                      </div>
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">Image</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-medium text-indigo-300">Review</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <p className="text-sm font-medium text-white/80 leading-tight truncate">{asset.title}</p>
                  <div className="flex items-center justify-between">
                    <ApprovalBadge status={asset.status} />
                    <span className="text-[10px] text-white/25">{formatRelativeTime(asset.createdAt)}</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Revision thread drawer */}
      <AnimatePresence>
        {selectedAsset && (
          <RevisionThread
            asset={selectedAsset}
            companyId={companyId}
            onClose={() => setSelectedAsset(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
