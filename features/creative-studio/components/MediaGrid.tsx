'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Clapperboard, Sparkles, CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApprovalBadge } from './ApprovalBadge';
import { RevisionThread } from './RevisionThread';
import { formatRelativeTime, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { CreativeAsset, AssetStatus } from '../types';

interface MediaGridProps {
  assets: CreativeAsset[];
  companyId: string;
  /** From server session (creative.approve). */
  canApproveCreative?: boolean;
  /** Platform super_admin — show permanent delete in inspector. */
  canDeleteCreative?: boolean;
}

const cardSpring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

const statusGlow: Record<AssetStatus, string> = {
  approved: '0 0 16px rgba(16,185,129,0.15)',
  pending:  '0 0 16px rgba(156,112,178,0.15)',
  revision: '0 0 16px rgba(244,63,94,0.12)',
};

const statusAccentBorder: Record<AssetStatus, string> = {
  approved: 'rgba(16,185,129,0.2)',
  pending:  'rgba(156,112,178,0.2)',
  revision: 'rgba(244,63,94,0.18)',
};

/** 'all' | 'unscheduled' | YYYY-MM */
type ScheduleScope = 'all' | 'unscheduled' | string;

function matchesSchedule(asset: CreativeAsset, scope: ScheduleScope): boolean {
  if (scope === 'all') return true;
  if (scope === 'unscheduled') return !asset.scheduledDate;
  if (!asset.scheduledDate) return false;
  return asset.scheduledDate.slice(0, 7) === scope;
}

function scheduleLabelOnCard(asset: CreativeAsset, noSchedule: string): string {
  if (!asset.scheduledDate) return noSchedule;
  const d = formatDate(asset.scheduledDate);
  if (asset.scheduledTime) {
    const short = asset.scheduledTime.length >= 5 ? asset.scheduledTime.slice(0, 5) : asset.scheduledTime;
    return `${d} · ${short}`;
  }
  return d;
}

export function MediaGrid({ assets: initialAssets, companyId, canApproveCreative = false, canDeleteCreative = false }: MediaGridProps) {
  const t = useTranslations('Features.Creative');

  const statusFilterItems: { value: AssetStatus | 'all'; labelKey: 'filterAll' | 'filterPending' | 'filterApproved' | 'filterRevision' }[] = [
    { value: 'all', labelKey: 'filterAll' },
    { value: 'pending', labelKey: 'filterPending' },
    { value: 'approved', labelKey: 'filterApproved' },
    { value: 'revision', labelKey: 'filterRevision' },
  ];

  function statusLabel(status: AssetStatus): string {
    if (status === 'approved') return t('statusApproved');
    if (status === 'pending') return t('statusPending');
    return t('statusRevision');
  }

  const [assets, setAssets] = useState<CreativeAsset[]>(initialAssets);
  const [filter, setFilter] = useState<AssetStatus | 'all'>('all');
  const [scheduleScope, setScheduleScope] = useState<ScheduleScope>('all');
  const [selectedAsset, setSelectedAsset] = useState<CreativeAsset | null>(null);

  useEffect(() => {
    setAssets(initialAssets);
    setSelectedAsset((sel) => {
      if (!sel) return null;
      const next = initialAssets.find((a) => a.id === sel.id);
      return next ?? null;
    });
  }, [initialAssets]);

  const bySchedule = assets.filter((a) => matchesSchedule(a, scheduleScope));
  const filtered = filter === 'all' ? bySchedule : bySchedule.filter((a) => a.status === filter);

  function handleStatusChange(assetId: string, newStatus: CreativeAsset['status']) {
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, status: newStatus } : a)));
    if (selectedAsset?.id === assetId) {
      setSelectedAsset((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  }

  function handleAssetDeleted(assetId: string) {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setSelectedAsset(null);
  }

  if (assets.length === 0) {
    return (
      <div
        className="relative flex flex-col items-center justify-center gap-5 py-16 text-center rounded-3xl border border-dashed border-white/[0.08] overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div
          className="w-14 h-14 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(156,112,178,0.1)', border: '1px solid rgba(156,112,178,0.2)' }}
        >
          <Clapperboard className="w-6 h-6 text-[#9c70b2]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/50 tracking-tight line-clamp-2">{t('emptyTitle')}</p>
          <p className="text-xs text-white/25 mt-1.5 line-clamp-3">{t('emptySubtitle')}</p>
        </div>
      </div>
    );
  }

  const monthInputValue =
    scheduleScope !== 'all' && scheduleScope !== 'unscheduled' ? scheduleScope : '';

  const filterToolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div
        className="inline-flex gap-1 p-1 rounded-2xl w-fit"
        style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {statusFilterItems.map((f) => (
          <motion.button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={cn(
              'relative px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
              filter === f.value ? 'text-white/90' : 'text-white/35 hover:text-white/55',
            )}
          >
            {filter === f.value && (
              <motion.div
                layoutId="creative-status-pill"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(156,112,178,0.22), rgba(190,160,66,0.12))',
                  border: '1px solid rgba(190,160,66,0.25)',
                }}
                transition={cardSpring}
              />
            )}
            <span className="relative z-10 truncate max-w-[5.5rem]">{t(f.labelKey)}</span>
            <span className="relative z-10 ml-1.5 text-white/22 tabular-nums">
              {f.value === 'all' ? bySchedule.length : bySchedule.filter((a) => a.status === f.value).length}
            </span>
          </motion.button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex gap-1 p-1 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {(['all', 'unscheduled'] as const).map((scope) => (
            <motion.button
              key={scope}
              type="button"
              onClick={() => setScheduleScope(scope)}
              whileTap={{ scale: 0.96 }}
              className={cn(
                'relative px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                scheduleScope === scope ? 'text-white/90' : 'text-white/35 hover:text-white/55',
              )}
            >
              {scheduleScope === scope && (
                <motion.div
                  layoutId="creative-schedule-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(190,160,66,0.18), rgba(156,112,178,0.14))',
                    border: '1px solid rgba(190,160,66,0.22)',
                  }}
                  transition={cardSpring}
                />
              )}
              <span className="relative z-10 truncate">{scope === 'all' ? t('scheduleAllDates') : t('scheduleUnscheduled')}</span>
            </motion.button>
          ))}
        </div>

        <label
          className="inline-flex items-center gap-2 rounded-2xl px-2 py-1 pl-3 cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <CalendarDays className="w-3.5 h-3.5 text-[#bea042]/80 shrink-0 pointer-events-none" />
          <span className="text-[10px] font-semibold text-white/28 uppercase tracking-wider shrink-0 pointer-events-none">
            {t('scheduleMonth')}
          </span>
          <input
            type="month"
            value={monthInputValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setScheduleScope(v);
            }}
            className="bg-transparent text-xs text-white/70 outline-none py-1.5 pr-2 cursor-pointer scheme-dark"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {filterToolbar}

      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-14 text-center rounded-3xl border border-dashed border-white/[0.08]"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <p className="text-sm font-medium text-white/45 line-clamp-2">{t('filteredEmptyTitle')}</p>
          <p className="text-xs text-white/25 max-w-sm line-clamp-4">
            {t('filteredEmptySubtitle')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((asset, i) => (
              <motion.div
                key={asset.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.93 }}
                transition={{ ...cardSpring, delay: Math.min(i * 0.06, 0.36) }}
                whileHover={{ y: -5, scale: 1.02 }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedAsset?.id === asset.id}
                aria-label={t('reviewAria', { title: asset.title, status: statusLabel(asset.status) })}
                onClick={() => setSelectedAsset(asset)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedAsset(asset);
                  }
                }}
                className="cursor-pointer group focus:outline-none rounded-3xl"
              >
                <div
                  className={cn(
                    'relative rounded-3xl border overflow-hidden transition-all duration-300',
                    selectedAsset?.id === asset.id && 'ring-2 ring-[#bea042]/55',
                  )}
                  style={{
                    background: 'rgba(29,15,29,0.5)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    border: `1px solid ${statusAccentBorder[asset.status]}`,
                    boxShadow: `${statusGlow[asset.status]}, inset 0 1px 0 rgba(255,255,255,0.10), inset 1px 0 0 rgba(255,255,255,0.05)`,
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/16 to-[#bea042]/10 z-10 pointer-events-none" />

                  <div
                    className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10"
                    style={{ boxShadow: 'inset 0 0 0 1px rgba(190,160,66,0.22)', background: 'rgba(190,160,66,0.025)' }}
                  />

                  <div className="relative h-44 bg-black/30 flex items-center justify-center overflow-hidden">
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
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(156,112,178,0.15)' }}>
                          <Video className="w-5 h-5 text-[#9c70b2]" />
                        </div>
                        <span className="text-[10px] text-white/25 uppercase tracking-wider">{t('mediaFallback')}</span>
                      </div>
                    )}

                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center"
                      style={{ background: 'rgba(156,112,178,0.15)', backdropFilter: 'blur(4px)' }}
                    >
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                        style={{ background: 'rgba(190,160,66,0.3)', border: '1px solid rgba(190,160,66,0.4)' }}
                      >
                        <Sparkles className="w-3 h-3" />
                        {t('inspect')}
                      </motion.span>
                    </div>

                    <div className="absolute top-3 left-3 z-20">
                      <ApprovalBadge status={asset.status} />
                    </div>
                  </div>

                  <div className="px-4 py-3.5 space-y-1 border-t border-white/[0.06]">
                    <p className="text-sm font-medium text-white/80 leading-tight truncate tracking-tight">{asset.title}</p>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[10px] text-[#bea042]/85 font-medium truncate max-w-full">{scheduleLabelOnCard(asset, t('noSchedule'))}</span>
                      <span className="text-[10px] text-white/22">· {formatRelativeTime(asset.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {selectedAsset ? (
          <RevisionThread
            key={selectedAsset.id}
            asset={selectedAsset}
            companyId={companyId}
            canApprove={canApproveCreative}
            canDeleteCreative={canDeleteCreative}
            onClose={() => setSelectedAsset(null)}
            onStatusChange={handleStatusChange}
            onAssetDeleted={handleAssetDeleted}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
