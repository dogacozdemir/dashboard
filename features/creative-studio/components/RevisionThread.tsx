'use client';

import { useState, useEffect, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Send, Loader2, MessageSquare,
  ExternalLink, PlayCircle, Plus, Trash2, Link2,
  Clock, Volume2, Type, Palette, Film,
  Image as ImageIcon, Layers, AlignLeft, User, Sunset,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { GlassCard } from '@/components/shared/GlassCard';
import { ApprovalBadge } from './ApprovalBadge';
import { fetchRevisions, addRevision, updateAssetStatus } from '../actions/fetchAssets';
import { triggerConfetti } from '@/features/gamification/components/CelebrationOverlay';
import { trackActivity } from '@/features/gamification/actions/trackActivity';
import { formatRelativeTime } from '@/lib/utils/format';
import type {
  CreativeAsset, Revision,
  VideoRevisionType, VideoRevisionMeta,
  ImageRevisionType, ImageRevisionMeta,
  RevisionReference,
} from '../types';

// ─── Video revision types ─────────────────────────────────────────────────────

const VIDEO_REVISION_TYPES: Array<{
  value: VideoRevisionType;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'full',       label: 'Tüm Video',       icon: Film,    color: 'indigo' },
  { value: 'time_range', label: 'Belirli Süre',    icon: Clock,   color: 'cyan'   },
  { value: 'audio',      label: 'Ses / Müzik',     icon: Volume2, color: 'violet' },
  { value: 'text',       label: 'Altyazı / Metin', icon: Type,    color: 'amber'  },
  { value: 'color',      label: 'Renk / Ton',      icon: Palette, color: 'emerald'},
];

// ─── Image revision types ─────────────────────────────────────────────────────

const IMAGE_REVISION_TYPES: Array<{
  value: ImageRevisionType;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'general',         label: 'Genel',              icon: ImageIcon, color: 'indigo' },
  { value: 'color_tone',      label: 'Renk & Ton',         icon: Palette,   color: 'emerald'},
  { value: 'text_typography', label: 'Metin & Tipografi',  icon: AlignLeft, color: 'amber'  },
  { value: 'composition',     label: 'Kompozisyon',        icon: Layers,    color: 'cyan'   },
  { value: 'background',      label: 'Arka Plan',          icon: Sunset,    color: 'violet' },
  { value: 'subject',         label: 'Ana Obje',           icon: User,      color: 'pink'   },
];

// ─── Color maps ───────────────────────────────────────────────────────────────

const COLOR_PILL: Record<string, string> = {
  indigo:  'bg-indigo-500/15 border-indigo-500/25 text-indigo-300',
  cyan:    'bg-cyan-500/15 border-cyan-500/25 text-cyan-300',
  violet:  'bg-violet-500/15 border-violet-500/25 text-violet-300',
  amber:   'bg-amber-500/15 border-amber-500/25 text-amber-300',
  emerald: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
  pink:    'bg-pink-500/15 border-pink-500/25 text-pink-300',
};

const COLOR_BADGE: Record<string, string> = {
  indigo:  'bg-indigo-500/10 text-indigo-400',
  cyan:    'bg-cyan-500/10 text-cyan-400',
  violet:  'bg-violet-500/10 text-violet-400',
  amber:   'bg-amber-500/10 text-amber-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  pink:    'bg-pink-500/10 text-pink-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPlatform(url: string): { label: string; color: string } {
  if (!url) return { label: 'Link', color: 'text-white/40' };
  if (/youtube\.com|youtu\.be/i.test(url))  return { label: 'YouTube',   color: 'text-red-400'  };
  if (/instagram\.com/i.test(url))           return { label: 'Instagram', color: 'text-pink-400' };
  if (/tiktok\.com/i.test(url))              return { label: 'TikTok',    color: 'text-white/70' };
  if (/twitter\.com|x\.com/i.test(url))      return { label: 'X',         color: 'text-sky-400'  };
  if (/vimeo\.com/i.test(url))               return { label: 'Vimeo',     color: 'text-cyan-400' };
  if (/linkedin\.com/i.test(url))            return { label: 'LinkedIn',  color: 'text-blue-400' };
  if (/pinterest\.com/i.test(url))           return { label: 'Pinterest', color: 'text-rose-400' };
  if (/behance\.net/i.test(url))             return { label: 'Behance',   color: 'text-blue-300' };
  if (/dribbble\.com/i.test(url))            return { label: 'Dribbble',  color: 'text-pink-300' };
  return { label: 'URL', color: 'text-white/40' };
}

function colorForVideoType(t: VideoRevisionType): string {
  return VIDEO_REVISION_TYPES.find((r) => r.value === t)?.color ?? 'indigo';
}
function labelForVideoType(t: VideoRevisionType): string {
  return VIDEO_REVISION_TYPES.find((r) => r.value === t)?.label ?? t;
}
function colorForImageType(t: ImageRevisionType): string {
  return IMAGE_REVISION_TYPES.find((r) => r.value === t)?.color ?? 'indigo';
}
function labelForImageType(t: ImageRevisionType): string {
  return IMAGE_REVISION_TYPES.find((r) => r.value === t)?.label ?? t;
}

// ─── Reference fields sub-component ──────────────────────────────────────────

function ReferenceFields({
  references,
  onChange,
}: {
  references: RevisionReference[];
  onChange: (refs: RevisionReference[]) => void;
}) {
  function add() {
    if (references.length >= 3) return;
    onChange([...references, { url: '', description: '' }]);
  }
  function update(idx: number, field: keyof RevisionReference, value: string) {
    onChange(references.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function remove(idx: number) {
    onChange(references.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <p className="text-[10px] text-white/30 mb-2">
        Referans Örnekler <span className="text-white/20">(opsiyonel, max 3)</span>
      </p>
      <div className="space-y-2">
        {references.map((ref, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Link2 className="w-3 h-3 text-white/25 shrink-0" />
                {ref.url && (
                  <span className={`text-[10px] font-medium ${detectPlatform(ref.url).color} shrink-0`}>
                    {detectPlatform(ref.url).label}
                  </span>
                )}
              </div>
              {references.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-white/20 hover:text-rose-400 transition-colors shrink-0 press-scale"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <input
              type="url"
              value={ref.url}
              onChange={(e) => update(idx, 'url', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/80 placeholder-white/20 text-xs outline-none focus:border-indigo-500/40 transition-all"
            />
            <input
              type="text"
              value={ref.description}
              onChange={(e) => update(idx, 'description', e.target.value)}
              placeholder="Bu örnekteki renk geçişi gibi olsun..."
              className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/80 placeholder-white/20 text-xs outline-none focus:border-indigo-500/40 transition-all"
            />
          </motion.div>
        ))}
        {references.length < 3 && (
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-indigo-400 transition-colors press-scale"
          >
            <Plus className="w-3.5 h-3.5" />
            Referans ekle
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RevisionThreadProps {
  asset:           CreativeAsset;
  companyId:       string;
  onClose:         () => void;
  onStatusChange?: (assetId: string, newStatus: CreativeAsset['status']) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RevisionThread({ asset, companyId, onClose, onStatusChange }: RevisionThreadProps) {
  const isVideo = asset.type === 'video';

  // Core state
  const [comment,             setComment]             = useState('');
  const [revisions,           setRevisions]           = useState<Revision[]>([]);
  const [loadingRevisions,    setLoadingRevisions]    = useState(true);
  const [isPending,           startTransition]        = useTransition();
  const [showApproveConfirm,  setShowApproveConfirm]  = useState(false);

  // Video metadata
  const [videoType,  setVideoType]  = useState<VideoRevisionType>('full');
  const [startTime,  setStartTime]  = useState('');
  const [endTime,    setEndTime]    = useState('');
  const [videoRefs,  setVideoRefs]  = useState<RevisionReference[]>([{ url: '', description: '' }]);

  // Image metadata
  const [imageType,  setImageType]  = useState<ImageRevisionType>('general');
  const [imageArea,  setImageArea]  = useState('');
  const [imageRefs,  setImageRefs]  = useState<RevisionReference[]>([{ url: '', description: '' }]);

  useEffect(() => {
    setLoadingRevisions(true);
    fetchRevisions(asset.id, companyId)
      .then(setRevisions)
      .finally(() => setLoadingRevisions(false));
  }, [asset.id, companyId]);

  // ── Submit ──
  function handleAddRevision() {
    if (!comment.trim()) return;
    if (isVideo && videoType === 'time_range' && (!startTime.trim() || !endTime.trim())) return;

    const videoMeta: VideoRevisionMeta | null = isVideo
      ? {
          revisionType: videoType,
          startTime:  videoType === 'time_range' ? startTime.trim() : undefined,
          endTime:    videoType === 'time_range' ? endTime.trim()   : undefined,
          references: videoRefs.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), description: r.description.trim() })),
        }
      : null;

    const imageMeta: ImageRevisionMeta | null = !isVideo
      ? {
          revisionType: imageType,
          area:       imageType !== 'general' && imageArea.trim() ? imageArea.trim() : undefined,
          references: imageRefs.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), description: r.description.trim() })),
        }
      : null;

    startTransition(async () => {
      const result = await addRevision(asset.id, companyId, comment.trim(), videoMeta, imageMeta);
      if (result.success) {
        // reset
        setComment('');
        setVideoType('full'); setStartTime(''); setEndTime('');
        setVideoRefs([{ url: '', description: '' }]);
        setImageType('general'); setImageArea('');
        setImageRefs([{ url: '', description: '' }]);
        const updated = await fetchRevisions(asset.id, companyId);
        setRevisions(updated);
        onStatusChange?.(asset.id, 'revision');
      }
    });
  }

  const canSubmit =
    comment.trim().length > 0 &&
    (!isVideo || videoType !== 'time_range' || (startTime.trim() && endTime.trim()));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-md h-full"
      >
        <GlassCard padding="none" className="h-full rounded-none rounded-l-2xl flex flex-col border-r-0">

          {/* ── Header ── */}
          <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-white/90 leading-tight">{asset.title}</h3>
              <ApprovalBadge status={asset.status} size="md" />
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors mt-0.5 press-scale">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Revision history ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">

            {/* Asset preview */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Preview</p>
              <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-black/20">
                {isVideo ? (
                  <video src={asset.url} controls className="w-full h-44 object-contain" preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.thumbnailUrl ?? asset.url} alt={asset.title} className="w-full h-44 object-contain" />
                )}
              </div>
              <a href={asset.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                {isVideo ? <PlayCircle className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Open full asset
              </a>
            </div>

            {/* Thread */}
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Revision Thread</p>

            {loadingRevisions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
              </div>
            ) : revisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <MessageSquare className="w-8 h-8 text-white/10" />
                <p className="text-sm text-white/30">Henüz revizyon yok</p>
                <p className="text-xs text-white/20">Aşağıdan not ekleyebilir veya onaylayabilirsiniz</p>
              </div>
            ) : (
              revisions.map((r) => <RevisionCard key={r.id} revision={r} />)
            )}
          </div>

          {/* ── Input area ── */}
          <div className="p-5 border-t border-white/[0.06] space-y-3">

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Revizyon notunu buraya yaz..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 placeholder-white/20 text-sm outline-none focus:border-indigo-500/50 resize-none transition-all"
            />

            {/* ── Video metadata ── */}
            <AnimatePresence>
              {isVideo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-1">
                    <SectionDivider label="Video Detayları" />

                    {/* Revision type */}
                    <TypeSelector
                      types={VIDEO_REVISION_TYPES}
                      value={videoType}
                      onChange={(v) => setVideoType(v as VideoRevisionType)}
                    />

                    {/* Time range */}
                    <AnimatePresence>
                      {videoType === 'time_range' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="text-[10px] text-white/30 mb-2">
                            Süre Aralığı <span className="text-white/20">(MM:SS)</span>
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="text" value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              placeholder="0:15" maxLength={7}
                              className="flex-1 px-3 py-2 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/20 text-white/80 placeholder-white/20 text-sm outline-none focus:border-cyan-500/40 transition-all text-center font-mono"
                            />
                            <span className="text-white/20 text-xs font-medium shrink-0">→</span>
                            <input
                              type="text" value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              placeholder="0:45" maxLength={7}
                              className="flex-1 px-3 py-2 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/20 text-white/80 placeholder-white/20 text-sm outline-none focus:border-cyan-500/40 transition-all text-center font-mono"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <ReferenceFields references={videoRefs} onChange={setVideoRefs} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Image metadata ── */}
            <AnimatePresence>
              {!isVideo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-1">
                    <SectionDivider label="Görsel Detayları" />

                    {/* Type selector */}
                    <TypeSelector
                      types={IMAGE_REVISION_TYPES}
                      value={imageType}
                      onChange={(v) => setImageType(v as ImageRevisionType)}
                    />

                    {/* Area field (hidden for "general") */}
                    <AnimatePresence>
                      {imageType !== 'general' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="text-[10px] text-white/30 mb-2">
                            Belirli Alan <span className="text-white/20">(opsiyonel)</span>
                          </p>
                          <input
                            type="text"
                            value={imageArea}
                            onChange={(e) => setImageArea(e.target.value)}
                            placeholder={
                              imageType === 'text_typography' ? 'örn: başlık metni, CTA butonu' :
                              imageType === 'composition'     ? 'örn: sol üst köşe, merkez obje' :
                              imageType === 'background'      ? 'örn: arka plan rengi, blur efekti' :
                              imageType === 'subject'         ? 'örn: ürün fotoğrafı, model pozu' :
                              'örn: sağ alt bölge'
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/80 placeholder-white/20 text-sm outline-none focus:border-indigo-500/40 transition-all"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <ReferenceFields references={imageRefs} onChange={setImageRefs} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddRevision}
                disabled={isPending || !canSubmit}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-white/70 text-sm font-medium transition-colors disabled:opacity-40 press-scale"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Revizyon Gönder
              </button>
              <button
                onClick={() => setShowApproveConfirm(true)}
                disabled={isPending || asset.status === 'approved'}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-medium transition-colors border border-emerald-500/20 disabled:opacity-40 press-scale"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Onayla
              </button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Approve confirmation */}
      <Dialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <DialogContent className="max-w-md bg-[#161625] border-white/[0.1] text-white/90">
          <DialogHeader>
            <DialogTitle>Onaylamak istediğinizden emin misiniz?</DialogTitle>
            <DialogDescription className="text-white/40">
              Bu kreatifleri onayladığınızda, yükleme sırasında girilen tarih/saatte Ops Takvimi&apos;ne Sosyal Paylaşım olarak eklenecektir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setShowApproveConfirm(false)}
              className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.09] transition-colors"
            >
              İptal
            </button>
            <button
              onClick={() => {
                startTransition(async () => {
                  const result = await updateAssetStatus(asset.id, 'approved', companyId);
                  if (result.success) {
                    triggerConfetti();
                    void trackActivity('creative_approved', { uploadedAt: asset.createdAt });
                    onStatusChange?.(asset.id, 'approved');
                    setShowApproveConfirm(false);
                    onClose();
                  }
                });
              }}
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-40 inline-flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Evet, Onayla
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-1">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function TypeSelector({
  types,
  value,
  onChange,
}: {
  types: Array<{ value: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] text-white/30 mb-2">Revizyon Tipi</p>
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => {
          const Icon = t.icon;
          const selected = value === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all press-scale
                ${selected
                  ? COLOR_PILL[t.color]
                  : 'bg-white/[0.03] border-white/[0.06] text-white/35 hover:text-white/60 hover:bg-white/[0.06]'
                }`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Revision card ────────────────────────────────────────────────────────────

function RevisionCard({ revision }: { revision: Revision }) {
  const vm = revision.videoMetadata;
  const im = revision.imageMetadata;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-indigo-400 truncate max-w-[180px]">{revision.createdBy}</span>
        <span className="text-[10px] text-white/25">{formatRelativeTime(revision.createdAt)}</span>
      </div>

      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-2.5">

        {/* Video badges */}
        {vm && (
          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${COLOR_BADGE[colorForVideoType(vm.revisionType)]}`}>
              {labelForVideoType(vm.revisionType)}
            </span>
            {vm.revisionType === 'time_range' && vm.startTime && vm.endTime && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">
                <Clock className="w-2.5 h-2.5" />
                {vm.startTime} → {vm.endTime}
              </span>
            )}
          </div>
        )}

        {/* Image badges */}
        {im && (
          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${COLOR_BADGE[colorForImageType(im.revisionType)]}`}>
              {labelForImageType(im.revisionType)}
            </span>
            {im.area && (
              <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50">
                {im.area}
              </span>
            )}
          </div>
        )}

        {/* Comment */}
        <p className="text-sm text-white/70 leading-relaxed">{revision.comment}</p>

        {/* References */}
        {(vm?.references?.length || im?.references?.length) ? (
          <div className="space-y-1.5 pt-1 border-t border-white/[0.05]">
            {(vm?.references ?? im?.references ?? []).map((ref, i) => {
              const platform = detectPlatform(ref.url);
              return (
                <div key={i} className="flex items-start gap-2">
                  <Link2 className="w-3 h-3 text-white/20 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <a href={ref.url} target="_blank" rel="noopener noreferrer"
                      className={`text-xs hover:underline truncate block ${platform.color}`}>
                      {platform.label} — {ref.url.length > 40 ? ref.url.slice(0, 40) + '…' : ref.url}
                    </a>
                    {ref.description && (
                      <p className="text-[11px] text-white/40 mt-0.5">{ref.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
