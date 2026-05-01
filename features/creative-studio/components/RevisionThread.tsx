'use client';

import { useState, useEffect, useLayoutEffect, useTransition, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Send, Loader2, MessageSquare,
  ExternalLink, PlayCircle, Plus, Trash2, Link2,
  Clock, Volume2, Type, Palette, Film,
  Image as ImageIcon, Layers, AlignLeft, User, Sunset,
  Sparkles, SlidersHorizontal,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ApprovalBadge } from './ApprovalBadge';
import { fetchRevisions, addRevision, updateAssetStatus } from '../actions/fetchAssets';
import { deleteCreativeAsset } from '../actions/deleteCreativeAsset';
import { triggerConfetti } from '@/features/gamification/components/CelebrationOverlay';
import { trackActivity } from '@/features/gamification/actions/trackActivity';
import { formatRelativeFromMessages } from '@/lib/i18n/format-relative-from-messages';
import { cn } from '@/lib/utils/cn';
import type {
  CreativeAsset, Revision,
  VideoRevisionType, VideoRevisionMeta,
  ImageRevisionType, ImageRevisionMeta,
  RevisionReference,
} from '../types';

// ─── Revision type definitions ────────────────────────────────────────────────

const VIDEO_REVISION_META: Array<{
  value: VideoRevisionType;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'full', icon: Film, color: 'amethyst' },
  { value: 'time_range', icon: Clock, color: 'cyan' },
  { value: 'audio', icon: Volume2, color: 'violet' },
  { value: 'text', icon: Type, color: 'gold' },
  { value: 'color', icon: Palette, color: 'emerald' },
];

const IMAGE_REVISION_META: Array<{
  value: ImageRevisionType;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'general', icon: ImageIcon, color: 'amethyst' },
  { value: 'color_tone', icon: Palette, color: 'emerald' },
  { value: 'text_typography', icon: AlignLeft, color: 'gold' },
  { value: 'composition', icon: Layers, color: 'cyan' },
  { value: 'background', icon: Sunset, color: 'violet' },
  { value: 'subject', icon: User, color: 'rose' },
];

/** Image axes that get a separate note field (General uses the top textarea). */
const IMAGE_ASPECT_NOTE_TYPES = IMAGE_REVISION_META.filter((row) => row.value !== 'general').map((row) => row.value);

function videoRevisionLabel(t: (key: string) => string, type: VideoRevisionType): string {
  switch (type) {
    case 'full':
      return t('videoFull');
    case 'time_range':
      return t('videoTimeRange');
    case 'audio':
      return t('videoAudio');
    case 'text':
      return t('videoText');
    case 'color':
      return t('videoColor');
    default:
      return type;
  }
}

function imageRevisionLabel(t: (key: string) => string, type: ImageRevisionType): string {
  switch (type) {
    case 'general':
      return t('imageGeneral');
    case 'color_tone':
      return t('imageColorTone');
    case 'text_typography':
      return t('imageTextTypography');
    case 'composition':
      return t('imageComposition');
    case 'background':
      return t('imageBackground');
    case 'subject':
      return t('imageSubject');
    default:
      return type;
  }
}

function createEmptyAspectNotes(): Record<ImageRevisionType, string> {
  return {
    general:         '',
    color_tone:      '',
    text_typography: '',
    composition:     '',
    background:      '',
    subject:         '',
  };
}

function pickNonEmptyAspectNotes(
  notes: Record<ImageRevisionType, string>,
): Partial<Record<ImageRevisionType, string>> {
  const out: Partial<Record<ImageRevisionType, string>> = {};
  for (const t of IMAGE_ASPECT_NOTE_TYPES) {
    const v = notes[t]?.trim();
    if (v) out[t] = v;
  }
  return out;
}

function orderedAspectNoteEntries(
  notes: Partial<Record<ImageRevisionType, string>> | undefined,
): Array<{ type: ImageRevisionType; text: string }> {
  if (!notes) return [];
  return IMAGE_ASPECT_NOTE_TYPES.flatMap((t) => {
    const raw = notes[t];
    const text = raw?.trim() ?? '';
    return text ? [{ type: t, text }] : [];
  });
}

const COLOR_PILL: Record<string, { bg: string; border: string; text: string }> = {
  amethyst: { bg: 'rgba(156,112,178,0.12)', border: 'rgba(156,112,178,0.28)', text: '#b48dc8' },
  cyan:     { bg: 'rgba(6,182,212,0.1)',    border: 'rgba(6,182,212,0.25)',   text: '#67e8f9' },
  violet:   { bg: 'rgba(139,92,246,0.1)',   border: 'rgba(139,92,246,0.25)',  text: '#c4b5fd' },
  gold:     { bg: 'rgba(190,160,66,0.1)',   border: 'rgba(190,160,66,0.28)',  text: '#bea042' },
  emerald:  { bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)', text: '#6ee7b7' },
  rose:     { bg: 'rgba(244,63,94,0.1)',    border: 'rgba(244,63,94,0.25)',   text: '#fb7185' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const drawerSpring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

function detectPlatform(url: string): { label: string; color: string } {
  if (!url) return { label: 'Link', color: 'text-white/40' };
  if (/youtube\.com|youtu\.be/i.test(url))  return { label: 'YouTube',   color: 'text-red-400'    };
  if (/instagram\.com/i.test(url))           return { label: 'Instagram', color: 'text-pink-400'   };
  if (/tiktok\.com/i.test(url))              return { label: 'TikTok',    color: 'text-white/70'   };
  if (/twitter\.com|x\.com/i.test(url))      return { label: 'X',         color: 'text-sky-400'    };
  if (/vimeo\.com/i.test(url))               return { label: 'Vimeo',     color: 'text-cyan-400'   };
  if (/linkedin\.com/i.test(url))            return { label: 'LinkedIn',  color: 'text-blue-400'   };
  return { label: 'URL', color: 'text-white/40' };
}

function colorForVideoType(tp: VideoRevisionType) {
  return VIDEO_REVISION_META.find((r) => r.value === tp)?.color ?? 'amethyst';
}
function colorForImageType(tp: ImageRevisionType) {
  return IMAGE_REVISION_META.find((r) => r.value === tp)?.color ?? 'amethyst';
}

// ─── Reference fields ─────────────────────────────────────────────────────────

function ReferenceFields({ references, onChange }: { references: RevisionReference[]; onChange: (refs: RevisionReference[]) => void }) {
  const t = useTranslations('Features.Creative.revisionThread');

  function add()   { if (references.length >= 3) return; onChange([...references, { url: '', description: '' }]); }
  function update(idx: number, field: keyof RevisionReference, value: string) { onChange(references.map((r, i) => (i === idx ? { ...r, [field]: value } : r))); }
  function remove(idx: number) { onChange(references.filter((_, i) => i !== idx)); }

  return (
    <div>
      <p className="text-[10px] text-white/28 mb-2 tracking-wide">
        {t('refsHeading')} <span className="text-white/18">{t('refsOptional')}</span>
      </p>
      <div className="space-y-2">
        {references.map((ref, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={drawerSpring}
            className="rounded-2xl p-3 space-y-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2">
              <Link2 className="w-3 h-3 text-white/20 shrink-0" />
              {ref.url && (
                <span className={`text-[10px] font-medium shrink-0 ${detectPlatform(ref.url).color}`}>
                  {detectPlatform(ref.url).label}
                </span>
              )}
              {references.length > 1 && (
                <button type="button" onClick={() => remove(idx)} className="ml-auto text-white/20 hover:text-rose-400 transition-colors press-scale">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <input type="url" value={ref.url} onChange={(e) => update(idx, 'url', e.target.value)} placeholder="https://..."
              className="w-full px-3 py-1.5 rounded-xl text-xs text-white/80 placeholder-white/18 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }} />
            <input type="text" value={ref.description} onChange={(e) => update(idx, 'description', e.target.value)} placeholder={t('refDescPlaceholder')}
              className="w-full px-3 py-1.5 rounded-xl text-xs text-white/80 placeholder-white/18 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }} />
          </motion.div>
        ))}
        {references.length < 3 && (
          <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-white/28 hover:text-[#9c70b2] transition-colors press-scale">
            <Plus className="w-3.5 h-3.5" />
            {t('refAdd')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Type selector ────────────────────────────────────────────────────────────

function TypeSelector({ heading, types, value, onChange, hasDraft }: {
  heading: string;
  types: Array<{ value: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string }>;
  value: string;
  onChange: (v: string) => void;
  /** Dot on chip when this option has unsaved text (e.g. image aspect note). */
  hasDraft?: (typeValue: string) => boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-white/28 mb-2 tracking-wide">{heading}</p>
      <div className="flex flex-wrap gap-1.5">
        {types.map((row) => {
          const Icon = row.icon;
          const selected = value === row.value;
          const pill = COLOR_PILL[row.color] ?? COLOR_PILL.amethyst;
          const drafted = hasDraft?.(row.value) ?? false;
          return (
            <motion.button
              key={row.value}
              type="button"
              whileTap={{ scale: 0.95 }}
              transition={drawerSpring}
              onClick={() => onChange(row.value)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all press-scale"
              style={selected ? {
                background: pill.bg,
                border: `1px solid ${pill.border}`,
                color: pill.text,
              } : {
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              <Icon className="w-3 h-3 shrink-0" />
              {row.label}
              {drafted && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: '#bea042', boxShadow: '0 0 8px rgba(190,160,66,0.45)' }}
                  aria-hidden
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <span className="text-[10px] font-semibold text-white/22 uppercase tracking-widest px-1">{label}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
    </div>
  );
}

// ─── Revision bubble card ─────────────────────────────────────────────────────

const COMMENT_COLLAPSE_AT = 200;

function RevisionCard({ revision }: { revision: Revision }) {
  const t = useTranslations('Features.Creative.revisionThread');
  const tRel = useTranslations('Shared.relativeTime');

  const vm = revision.videoMetadata;
  const im = revision.imageMetadata;
  const [threadExpanded, setThreadExpanded] = useState(false);
  const aspectEntries = orderedAspectNoteEntries(im?.aspectNotes);
  const hasNewAspects = aspectEntries.length > 0;
  const legacyIm = im && !hasNewAspects && im.revisionType;
  const hasComment = revision.comment.trim().length > 0;
  const needsThreadClamp =
    hasComment &&
    (revision.comment.length > COMMENT_COLLAPSE_AT || revision.comment.split('\n').length > 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={drawerSpring}
      className="flex gap-2.5"
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-xl shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold text-white/60"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        {revision.createdBy.slice(0, 2).toUpperCase()}
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-semibold text-[#b48dc8]">{revision.createdBy}</span>
          <span className="text-[9px] text-white/22">{formatRelativeFromMessages(revision.createdAt, tRel)}</span>
        </div>

        <div
          className="rounded-2xl rounded-tl-[6px] p-3.5 space-y-2.5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(12px)' }}
        >
          {/* Video + legacy image badges */}
          {(vm || legacyIm) && (
            <div className="flex flex-wrap gap-1.5">
              {vm && (() => {
                const pill = COLOR_PILL[colorForVideoType(vm.revisionType)] ?? COLOR_PILL.amethyst;
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: pill.bg, border: `1px solid ${pill.border}`, color: pill.text }}>
                    {videoRevisionLabel(t, vm.revisionType)}
                  </span>
                );
              })()}
              {vm?.revisionType === 'time_range' && vm.startTime && vm.endTime && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', color: '#67e8f9' }}>
                  <Clock className="w-2.5 h-2.5" />{vm.startTime} → {vm.endTime}
                </span>
              )}
              {legacyIm && (() => {
                const pill = COLOR_PILL[colorForImageType(im.revisionType!)] ?? COLOR_PILL.amethyst;
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: pill.bg, border: `1px solid ${pill.border}`, color: pill.text }}>
                    {imageRevisionLabel(t, im.revisionType!)}
                  </span>
                );
              })()}
              {legacyIm && im?.area && (
                <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full text-white/45"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  {im.area}
                </span>
              )}
            </div>
          )}

          {/* Multi-aspect image notes */}
          {hasNewAspects && (
            <div className="space-y-3">
              {aspectEntries.map(({ type, text }) => {
                const pill = COLOR_PILL[colorForImageType(type)] ?? COLOR_PILL.amethyst;
                return (
                  <div key={type} className="space-y-1.5">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: pill.bg, border: `1px solid ${pill.border}`, color: pill.text }}
                    >
                      {imageRevisionLabel(t, type)}
                    </span>
                    <p className="text-sm text-white/78 leading-relaxed whitespace-pre-wrap">{text}</p>
                  </div>
                );
              })}
            </div>
          )}

          {hasComment && (
            <div className="space-y-1">
              {hasNewAspects && (
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.1em]">{t('generalNoteLabel')}</p>
              )}
              <p
                className={cn(
                  'text-sm text-white/78 leading-relaxed whitespace-pre-wrap',
                  needsThreadClamp && !threadExpanded && 'line-clamp-4',
                )}
              >
                {revision.comment}
              </p>
              {needsThreadClamp && (
                <button
                  type="button"
                  onClick={() => setThreadExpanded((e) => !e)}
                  className="text-[10px] font-semibold text-[#9c70b2]/90 hover:text-[#b48dc8] transition-colors"
                >
                  {threadExpanded ? t('collapseThread') : t('expandThread')}
                </button>
              )}
            </div>
          )}

          {/* References */}
          {(vm?.references?.length || im?.references?.length) ? (
            <div className="space-y-1.5 pt-1.5 border-t border-white/[0.06]">
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
                      {ref.description && <p className="text-[11px] text-white/38 mt-0.5">{ref.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RevisionThreadProps {
  asset:           CreativeAsset;
  companyId:       string;
  /** Only tenant_admin / super_admin (creative.approve). */
  canApprove?:     boolean;
  /** Platform super_admin — permanent delete (DB + S3). */
  canDeleteCreative?: boolean;
  onClose:         () => void;
  onStatusChange?: (assetId: string, newStatus: CreativeAsset['status']) => void;
  onAssetDeleted?: (assetId: string) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RevisionThread({
  asset,
  companyId,
  canApprove = false,
  canDeleteCreative = false,
  onClose,
  onStatusChange,
  onAssetDeleted,
}: RevisionThreadProps) {
  const isVideo = asset.type === 'video';

  /** `motion.main` (page transition) uses transform; `fixed` inside it anchors to content, not the viewport. Portal restores real viewport-fixed behavior. */
  const [portalReady, setPortalReady] = useState(false);
  useLayoutEffect(() => {
    setPortalReady(true);
  }, []);

  const [comment,            setComment]            = useState('');
  const [revisions,          setRevisions]          = useState<Revision[]>([]);
  const [loadingRevisions,   setLoadingRevisions]   = useState(true);
  const [isPending,          startTransition]       = useTransition();
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [revisionDetailsOpen, setRevisionDetailsOpen] = useState(false);

  const [videoType, setVideoType] = useState<VideoRevisionType>('full');
  const [startTime, setStartTime] = useState('');
  const [endTime,   setEndTime]   = useState('');
  const [videoRefs, setVideoRefs] = useState<RevisionReference[]>([{ url: '', description: '' }]);

  const [aspectNotes, setAspectNotes] = useState<Record<ImageRevisionType, string>>(createEmptyAspectNotes);
  const [activeImageAspect, setActiveImageAspect] = useState<ImageRevisionType>(IMAGE_ASPECT_NOTE_TYPES[0]);
  const [imageRefs, setImageRefs] = useState<RevisionReference[]>([{ url: '', description: '' }]);

  const t = useTranslations('Features.Creative.revisionThread');

  const VIDEO_REVISION_TYPES = useMemo(
    () =>
      VIDEO_REVISION_META.map((row) => ({
        ...row,
        label: videoRevisionLabel(t, row.value),
      })),
    [t],
  );

  const IMAGE_REVISION_TYPES_LABELED = useMemo(
    () =>
      IMAGE_REVISION_META.map((row) => ({
        ...row,
        label: imageRevisionLabel(t, row.value),
      })),
    [t],
  );

  const IMAGE_ASPECT_SELECTOR_TYPES = useMemo(
    () => IMAGE_REVISION_TYPES_LABELED.filter((row) => row.value !== 'general'),
    [IMAGE_REVISION_TYPES_LABELED],
  );

  useEffect(() => {
    setLoadingRevisions(true);
    fetchRevisions(asset.id, companyId)
      .then(setRevisions)
      .finally(() => setLoadingRevisions(false));
  }, [asset.id, companyId]);

  useEffect(() => {
    setActiveImageAspect(IMAGE_ASPECT_NOTE_TYPES[0]);
  }, [asset.id]);

  function handleAddRevision() {
    if (isVideo) {
      if (!comment.trim()) return;
      if (videoType === 'time_range' && (!startTime.trim() || !endTime.trim())) return;
    } else {
      const aspects = pickNonEmptyAspectNotes(aspectNotes);
      const ir = imageRefs.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), description: r.description.trim() }));
      if (!comment.trim() && Object.keys(aspects).length === 0 && ir.length === 0) return;
    }

    const videoMeta: VideoRevisionMeta | null = isVideo ? {
      revisionType: videoType,
      startTime:  videoType === 'time_range' ? startTime.trim() : undefined,
      endTime:    videoType === 'time_range' ? endTime.trim()   : undefined,
      references: videoRefs.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), description: r.description.trim() })),
    } : null;

    const imageMeta: ImageRevisionMeta | null = !isVideo ? (() => {
      const aspects = pickNonEmptyAspectNotes(aspectNotes);
      const references = imageRefs.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), description: r.description.trim() }));
      const payload: ImageRevisionMeta = {};
      if (Object.keys(aspects).length > 0) payload.aspectNotes = aspects;
      if (references.length > 0) payload.references = references;
      return Object.keys(payload).length > 0 ? payload : null;
    })() : null;

    startTransition(async () => {
      const result = await addRevision(asset.id, companyId, comment.trim(), videoMeta, imageMeta);
      if (result.success) {
        setComment('');
        setVideoType('full'); setStartTime(''); setEndTime('');
        setVideoRefs([{ url: '', description: '' }]);
        setAspectNotes(createEmptyAspectNotes());
        setImageRefs([{ url: '', description: '' }]);
        const updated = await fetchRevisions(asset.id, companyId);
        setRevisions(updated);
        onStatusChange?.(asset.id, 'revision');
      }
    });
  }

  const videoTimeOk = videoType !== 'time_range' || (startTime.trim().length > 0 && endTime.trim().length > 0);
  const imageHasRefs = imageRefs.some((r) => r.url.trim());
  const imageHasAspects = Object.keys(pickNonEmptyAspectNotes(aspectNotes)).length > 0;
  const hasRevisionSubstance = isVideo
    ? comment.trim().length > 0 && videoTimeOk
    : comment.trim().length > 0 || imageHasAspects || imageHasRefs;

  const canSubmit = hasRevisionSubstance;

  function handleSubmitRevision() {
    if (isPending || !hasRevisionSubstance) return;
    if (isVideo && videoType === 'time_range' && (!startTime.trim() || !endTime.trim())) {
      setRevisionDetailsOpen(true);
      return;
    }
    handleAddRevision();
  }

  const glassPanel = (
        <div
          className="relative flex min-h-0 flex-col h-full rounded-3xl border border-white/[0.12] overflow-hidden"
          style={{
            background: 'rgba(22, 10, 22, 0.72)',
            backdropFilter: 'blur(48px) saturate(200%)',
            WebkitBackdropFilter: 'blur(48px) saturate(200%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 1px 0 0 rgba(255,255,255,0.07), 0 32px 80px rgba(0,0,0,0.55)',
          }}
        >
          {/* Top rim light */}
          <div className="absolute top-0 left-0 right-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          {/* ── Header ── */}
          <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-white/[0.07]">
            <div className="space-y-2 min-w-0">
              <h3 className="text-sm font-semibold text-white/88 leading-tight tracking-tight truncate pr-4">
                {asset.title}
              </h3>
              <ApprovalBadge status={asset.status} size="md" />
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              transition={drawerSpring}
              onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <X className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: 'none' }}>

            {/* ── Hero asset preview ── */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.12em]">{t('assetPreview')}</p>
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 1px 0 0 rgba(255,255,255,0.07)',
                }}
              >
                {/* Rim light overlay */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10 pointer-events-none" />
                <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/12 via-transparent to-transparent z-10 pointer-events-none" />

                {isVideo ? (
                  <video src={asset.url} controls className="w-full h-52 object-contain bg-black/40" preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.thumbnailUrl ?? asset.url} alt={asset.title} className="w-full h-52 object-contain bg-black/30" />
                )}
              </div>
              <a href={asset.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#9c70b2] hover:text-[#b48dc8] transition-colors">
                {isVideo ? <PlayCircle className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                {t('openFullAsset')}
              </a>
            </div>

            {/* ── Revision thread ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.12em]">{t('revisionThreadHeading')}</p>

              {loadingRevisions ? (
                <div className="flex items-center justify-center py-8">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Loader2 className="w-5 h-5 text-[#9c70b2]/40" />
                  </motion.div>
                </div>
              ) : revisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <MessageSquare className="w-4.5 h-4.5 text-white/15" />
                  </div>
                  <p className="text-sm text-white/28">{t('emptyTitle')}</p>
                  <p className="text-xs text-white/18">{t('emptySubtitle')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {revisions.map((r) => <RevisionCard key={r.id} revision={r} />)}
                </div>
              )}
            </div>

            {canDeleteCreative && (
              <div
                className="rounded-2xl p-4 space-y-2"
                style={{
                  border: '1px solid rgba(244,63,94,0.22)',
                  background: 'rgba(244,63,94,0.06)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                <p className="text-[10px] font-semibold text-rose-300/90 uppercase tracking-[0.12em]">
                  {t('dangerZoneTitle')}
                </p>
                <p className="text-xs text-white/40 leading-relaxed">
                  {t('dangerZoneBody')}
                </p>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  transition={drawerSpring}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-rose-200/95 transition-opacity disabled:opacity-45"
                  style={{
                    background: 'rgba(244,63,94,0.14)',
                    border: '1px solid rgba(244,63,94,0.35)',
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('deleteCreativeCta')}
                </motion.button>
              </div>
            )}
          </div>

          {/* ── Composer: scrollable fields + fixed actions ── */}
          <div className="flex shrink-0 flex-col border-t border-white/[0.07] bg-[rgba(12,6,14,0.55)] backdrop-blur-sm">
            <div
              className="min-h-0 max-h-[min(40vh,400px)] sm:max-h-[min(44vh,440px)] overflow-y-auto overscroll-contain px-4 pt-3 pb-1"
              style={{ scrollbarWidth: 'thin' }}
            >
              <div
                className="rounded-3xl border border-white/[0.10] p-4 space-y-3"
                style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(24px) saturate(180%)' }}
              >
              {/* Textarea */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={isVideo ? t('placeholderVideoComment') : t('placeholderImageComment')}
                rows={2}
                className="w-full bg-transparent text-sm text-white/88 placeholder-white/22 outline-none resize-none leading-relaxed"
                style={{ minHeight: 48, maxHeight: 100 }}
              />

              {/* Structured revision fields (collapsed by default) */}
              <AnimatePresence initial={false}>
                {revisionDetailsOpen && isVideo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-1 border-t border-white/[0.06]">
                      <SectionDivider label={t('sectionVideoDetails')} />
                      <TypeSelector
                        heading={t('revisionTypeLabel')}
                        types={VIDEO_REVISION_TYPES}
                        value={videoType}
                        onChange={(v) => setVideoType(v as VideoRevisionType)}
                      />
                      <AnimatePresence>
                        {videoType === 'time_range' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 28 }} className="overflow-hidden"
                          >
                            <p className="text-[10px] text-white/28 mb-2">
                              {t('timeRangeLabel')} <span className="text-white/18">{t('timeRangeFormatHint')}</span>
                            </p>
                            <div className="flex items-center gap-2">
                              <input type="text" value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="0:15" maxLength={7}
                                className="flex-1 px-3 py-2 rounded-xl text-sm text-white/80 placeholder-white/20 outline-none transition-all text-center font-mono"
                                style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)' }} />
                              <span className="text-white/20 text-xs font-medium shrink-0">→</span>
                              <input type="text" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="0:45" maxLength={7}
                                className="flex-1 px-3 py-2 rounded-xl text-sm text-white/80 placeholder-white/20 outline-none transition-all text-center font-mono"
                                style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)' }} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <ReferenceFields references={videoRefs} onChange={setVideoRefs} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {revisionDetailsOpen && !isVideo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28 }} className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-1 border-t border-white/[0.06]">
                      <SectionDivider label={t('sectionImageDetails')} />
                      <p className="text-[10px] text-white/22 leading-relaxed">
                        {t('imageDetailsHint')}
                      </p>
                      <TypeSelector
                        heading={t('revisionTypeLabel')}
                        types={IMAGE_ASPECT_SELECTOR_TYPES}
                        value={activeImageAspect}
                        onChange={(v) => setActiveImageAspect(v as ImageRevisionType)}
                        hasDraft={(v) => Boolean(aspectNotes[v as ImageRevisionType]?.trim())}
                      />
                      {(() => {
                        const aspectMeta = IMAGE_REVISION_TYPES_LABELED.find((row) => row.value === activeImageAspect)!;
                        const AspectIcon = aspectMeta.icon;
                        const pill = COLOR_PILL[aspectMeta.color] ?? COLOR_PILL.amethyst;
                        return (
                          <motion.div
                            key={activeImageAspect}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            className="space-y-2 rounded-2xl p-3"
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: pill.bg, border: `1px solid ${pill.border}` }}
                              >
                                <span className="flex" style={{ color: pill.text }}>
                                  <AspectIcon className="w-4 h-4 shrink-0" />
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white/80 tracking-tight">{aspectMeta.label}</p>
                                <p className="text-[10px] text-white/28 mt-0.5">{t('aspectNoteCaption')}</p>
                              </div>
                            </div>
                            <textarea
                              value={aspectNotes[activeImageAspect] ?? ''}
                              onChange={(e) =>
                                setAspectNotes((prev) => ({ ...prev, [activeImageAspect]: e.target.value }))
                              }
                              placeholder={t('aspectNotePlaceholder')}
                              rows={3}
                              className="w-full px-3 py-2.5 rounded-xl text-sm text-white/88 placeholder-white/20 outline-none resize-none leading-relaxed"
                              style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                minHeight: 64,
                                maxHeight: 112,
                              }}
                            />
                          </motion.div>
                        );
                      })()}
                      <ReferenceFields references={imageRefs} onChange={setImageRefs} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>

            <div
              className="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
              style={{ boxShadow: '0 -10px 28px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  transition={drawerSpring}
                  onClick={() => setRevisionDetailsOpen((o) => !o)}
                  aria-expanded={revisionDetailsOpen}
                  aria-label={revisionDetailsOpen ? t('ariaHideDetails') : t('ariaShowDetails')}
                  className={cn(
                    'shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-colors',
                    revisionDetailsOpen ? 'text-[#b48dc8]' : 'text-white/35 hover:text-white/55',
                  )}
                  style={{
                    background: revisionDetailsOpen ? 'rgba(156,112,178,0.14)' : 'rgba(255,255,255,0.04)',
                    border: revisionDetailsOpen ? '1px solid rgba(156,112,178,0.28)' : '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  transition={drawerSpring}
                  onClick={handleSubmitRevision}
                  disabled={isPending || !hasRevisionSubstance}
                  className={cn(
                    'flex flex-1 min-w-0 items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all',
                    canSubmit && !isPending ? 'text-white/80' : 'text-white/30',
                  )}
                  style={{
                    background: canSubmit ? 'rgba(156,112,178,0.12)' : 'rgba(255,255,255,0.04)',
                    border: canSubmit ? '1px solid rgba(156,112,178,0.25)' : '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {t('submitRevision')}
                </motion.button>

                {canApprove && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  transition={drawerSpring}
                  onClick={() => setShowApproveConfirm(true)}
                  disabled={isPending || asset.status === 'approved'}
                  className="flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, #d4b44c 0%, #bea042 50%, #a07b28 100%)',
                    boxShadow: '0 0 16px rgba(190,160,66,0.3)',
                    color: '#1a0f00',
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('approve')}
                </motion.button>
                )}
              </div>
            </div>
          </div>
        </div>
  );

  const approveDialog = (
      <Dialog open={canApprove && showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <DialogContent
          className="max-w-md border-white/[0.12] text-white/90 rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(22,10,22,0.9)',
            backdropFilter: 'blur(48px) saturate(200%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.5)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-white/88 tracking-tight">{t('approveConfirmTitle')}</DialogTitle>
            <DialogDescription className="text-white/38 leading-relaxed">
              {t('approveConfirmBody')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowApproveConfirm(false)}
              className="px-4 py-2 rounded-2xl text-sm text-white/55 hover:text-white/75 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              {t('cancel')}
            </button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={drawerSpring}
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #d4b44c 0%, #bea042 50%, #a07b28 100%)',
                boxShadow: '0 0 16px rgba(190,160,66,0.35)',
                color: '#1a0f00',
              }}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {t('approveConfirmSubmit')}
            </motion.button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  const deleteDialog = (
    <Dialog open={canDeleteCreative && showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent
        className="max-w-md border-white/[0.12] text-white/90 rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(22,10,22,0.9)',
          backdropFilter: 'blur(48px) saturate(200%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-white/88 tracking-tight">{t('deleteConfirmTitle')}</DialogTitle>
          <DialogDescription className="text-white/38 leading-relaxed">
            {t('deleteConfirmBody')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 rounded-2xl text-sm text-white/55 hover:text-white/75 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            {t('cancel')}
          </button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={drawerSpring}
            onClick={() => {
              startTransition(async () => {
                const result = await deleteCreativeAsset(asset.id, companyId);
                if (result.success) {
                  setShowDeleteConfirm(false);
                  onAssetDeleted?.(asset.id);
                  onClose();
                }
              });
            }}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-semibold disabled:opacity-40 text-rose-100"
            style={{
              background: 'rgba(244,63,94,0.22)',
              border: '1px solid rgba(244,63,94,0.4)',
              boxShadow: '0 0 14px rgba(244,63,94,0.2)',
            }}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {t('deleteConfirmSubmit')}
          </motion.button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const overlay = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-end px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: '110%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '110%', opacity: 0 }}
        transition={drawerSpring}
        className="flex min-h-0 w-full max-w-[440px] flex-col"
        style={{
          height: 'min(820px, calc(100dvh - 1rem - max(1rem, env(safe-area-inset-bottom, 0px)) - 1rem))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {glassPanel}
      </motion.div>
    </motion.div>
  );

  return (
    <>
      {portalReady ? createPortal(overlay, document.body) : null}
      {approveDialog}
      {deleteDialog}
    </>
  );
}
