'use client';

import { useState, useEffect, useLayoutEffect, useTransition, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Send, Loader2, MessageSquare,
  ExternalLink, PlayCircle, Plus, Trash2, Link2,
  Clock, Volume2, Type, Palette, Film,
  Image as ImageIcon, Layers, AlignLeft, User, Sunset,
  Sparkles, SlidersHorizontal, ChevronLeft, ChevronRight,
  Pencil, Check, RotateCcw, MapPin, Crosshair, Maximize2,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ApprovalBadge } from './ApprovalBadge';
import {
  fetchRevisionsForPost, addRevision, updateAssetStatus,
  setRevisionResolved, editRevision, deleteRevision,
} from '../actions/fetchAssets';
import { deleteCreativePost } from '../actions/deleteCreativePost';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ensureRealtimeAuth } from '@/lib/supabase/realtime';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  triggerAchievementToast,
  triggerConfetti,
  triggerLevelUp,
} from '@/features/gamification/components/CelebrationOverlay';
import { ACHIEVEMENT_MAP } from '@/features/gamification/lib/definitions';
import { formatRelativeFromMessages } from '@/lib/i18n/format-relative-from-messages';
import { cn } from '@/lib/utils/cn';
import type {
  CreativePost, Revision,
  VideoRevisionType, VideoRevisionMeta,
  ImageRevisionType, ImageRevisionMeta,
  RevisionReference, RevisionPin,
} from '../types';
import { PublishNowButton } from './PublishNowButton';
import { VisionReviewPanel } from './VisionReviewPanel';

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

/** Seconds → "M:SS" timecode (for video playhead capture). */
function secondsToTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

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

function RevisionCard({
  revision,
  slides,
  canApprove,
  currentUserId,
  canDeleteAny,
  onResolveToggle,
  onEdit,
  onDelete,
  busy,
}: {
  revision: Revision;
  slides: CreativePost['slides'];
  canApprove: boolean;
  currentUserId: string | null;
  canDeleteAny: boolean;
  onResolveToggle: (revision: Revision) => void;
  onEdit: (revisionId: string, comment: string) => void;
  onDelete: (revisionId: string) => void;
  busy: boolean;
}) {
  const t = useTranslations('Features.Creative.revisionThread');
  const tRel = useTranslations('Shared.relativeTime');

  const vm = revision.videoMetadata;
  const im = revision.imageMetadata;
  const pins = im?.pins ?? [];
  const pinSlide = pins.length ? (slides.find((s) => s.slideIndex === pins[0].slideIndex) ?? null) : null;
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(revision.comment);
  const aspectEntries = orderedAspectNoteEntries(im?.aspectNotes);
  const hasNewAspects = aspectEntries.length > 0;
  const legacyIm = im && !hasNewAspects && im.revisionType;
  const hasComment = revision.comment.trim().length > 0;
  const needsThreadClamp =
    hasComment &&
    (revision.comment.length > COMMENT_COLLAPSE_AT || revision.comment.split('\n').length > 4);

  const isResolved = Boolean(revision.resolvedAt);
  const isAuthor = currentUserId != null && currentUserId === revision.createdById;
  const canRemove = isAuthor || canDeleteAny;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={drawerSpring}
      className={cn('flex gap-2.5', isResolved && 'opacity-60')}
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
          {revision.updatedAt && (
            <span className="text-[9px] text-white/22 italic">{t('editedTag')}</span>
          )}

          {/* Row actions */}
          <div className="ml-auto flex items-center gap-1.5">
            {isAuthor && !isResolved && (
              <button
                type="button"
                onClick={() => { setDraft(revision.comment); setEditing((e) => !e); }}
                disabled={busy}
                aria-label={t('editRevisionAria')}
                className="text-white/25 hover:text-[#b48dc8] transition-colors press-scale disabled:opacity-40"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {canRemove && (
              <button
                type="button"
                onClick={() => onDelete(revision.id)}
                disabled={busy}
                aria-label={t('deleteRevisionAria')}
                className="text-white/25 hover:text-rose-400 transition-colors press-scale disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            {canApprove && (
              <button
                type="button"
                onClick={() => onResolveToggle(revision)}
                disabled={busy}
                aria-label={isResolved ? t('reopenRevisionAria') : t('resolveRevisionAria')}
                className={cn(
                  'transition-colors press-scale disabled:opacity-40',
                  isResolved ? 'text-white/30 hover:text-white/55' : 'text-emerald-400/70 hover:text-emerald-300',
                )}
              >
                {isResolved ? <RotateCcw className="w-3 h-3" /> : <Check className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        <div
          className="rounded-2xl rounded-tl-[6px] p-3.5 space-y-2.5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(12px)' }}
        >
          {/* Resolved chip */}
          {isResolved && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}
            >
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              {revision.resolvedBy ? t('resolvedByBadge', { name: revision.resolvedBy }) : t('resolvedBadge')}
            </span>
          )}

          {/* Visual pins on the annotated slide */}
          {pins.length > 0 && pinSlide && (
            <div className="space-y-2">
              <div
                className="relative h-52 w-full overflow-hidden rounded-xl bg-black/40"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pinSlide.thumbnailUrl ?? pinSlide.url}
                  alt={pinSlide.title}
                  className="h-full w-full object-contain"
                />
                {pins.map((pin, i) => (
                  <span
                    key={i}
                    className="absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg"
                    style={{
                      left: `${pin.xPct}%`,
                      top: `${pin.yPct}%`,
                      background: 'rgba(156,112,178,0.95)',
                      border: '1.5px solid rgba(255,255,255,0.85)',
                    }}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
              <div className="space-y-1.5">
                {pins.map((pin, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: 'rgba(156,112,178,0.9)' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm text-white/78 leading-relaxed whitespace-pre-wrap">
                      {pin.note.trim() || t('pinNoNote')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video + legacy image badges */}
          {(vm || legacyIm || (revision.slideIndex !== null && revision.slideIndex !== undefined)) && (
            <div className="flex flex-wrap gap-1.5">
              {revision.slideIndex !== null && revision.slideIndex !== undefined && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(190,160,66,0.12)',
                    border: '1px solid rgba(190,160,66,0.35)',
                    color: '#bea042',
                  }}
                >
                  <Layers className="w-3 h-3 shrink-0" />
                  {t('slideBadge', { n: revision.slideIndex + 1 })}
                </span>
              )}
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

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                autoFocus
                className="w-full rounded-xl px-3 py-2 text-sm text-white/88 placeholder-white/22 outline-none resize-none leading-relaxed"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { onEdit(revision.id, draft.trim()); setEditing(false); }}
                  disabled={busy || draft.trim() === revision.comment.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white/80 disabled:opacity-40"
                  style={{ background: 'rgba(156,112,178,0.14)', border: '1px solid rgba(156,112,178,0.28)' }}
                >
                  <Check className="w-3 h-3" />
                  {t('saveEdit')}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(revision.comment); }}
                  className="px-3 py-1.5 rounded-xl text-xs text-white/45 hover:text-white/70 transition-colors"
                >
                  {t('cancelEdit')}
                </button>
              </div>
            </div>
          ) : hasComment ? (
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
          ) : null}

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
  post:            CreativePost;
  companyId:       string;
  /** Only tenant_admin / super_admin (creative.approve). */
  canApprove?:     boolean;
  /** Platform super_admin — permanent delete (DB + S3). */
  canDeleteCreative?: boolean;
  /** Current session user id — gates edit/delete of own revisions. */
  currentUserId?:  string | null;
  onClose:         () => void;
  onStatusChange?: (postId: string, newStatus: CreativePost['status']) => void;
  /** Fired after a manual publish so the grid can reflect the new live state. */
  onPublished?: (postId: string, igMediaId: string) => void;
  onPostDeleted?: (postId: string) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RevisionThread({
  post,
  companyId,
  canApprove = false,
  canDeleteCreative = false,
  currentUserId = null,
  onClose,
  onStatusChange,
  onPublished,
  onPostDeleted,
}: RevisionThreadProps) {
  const slides = post.slides ?? [];
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [revisionCommentTarget, setRevisionCommentTarget] = useState<'whole' | number>('whole');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Esc closes the topmost layer: the full-size viewer first, then the drawer.
  // The ref keeps the handler side-effect-free — calling onClose() inside a
  // state updater fires twice under React's dev double-invoke and closes both.
  const lightboxOpenRef = useRef(false);
  useEffect(() => {
    lightboxOpenRef.current = lightboxOpen;
  }, [lightboxOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (lightboxOpenRef.current) setLightboxOpen(false);
      else onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const clampedIdx = Math.min(Math.max(0, activeSlideIdx), Math.max(0, slides.length - 1));
  const activeSlide = slides[clampedIdx] ?? slides[0];
  const heroIsVideo = activeSlide?.type === 'video';

  /** Draft visual pins for the current image slide (percent-based). */
  const [pins, setPins] = useState<RevisionPin[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  const carouselViewportRef = useRef<HTMLDivElement>(null);
  const [carouselW, setCarouselW] = useState(280);
  useLayoutEffect(() => {
    const el = carouselViewportRef.current;
    if (!el) return;
    const measure = () => setCarouselW(Math.max(el.clientWidth, 1));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [post.id, slides.length]);

  const revisionAnchorSlide = useMemo(() => {
    if (!slides.length) return undefined;
    if (revisionCommentTarget === 'whole') return slides[0];
    return slides[revisionCommentTarget as number] ?? slides[0];
  }, [slides, revisionCommentTarget]);

  const composerIsVideo = revisionAnchorSlide?.type === 'video';

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

  const refetchRevisions = useCallback(() => {
    return fetchRevisionsForPost(post.id, companyId).then(setRevisions);
  }, [post.id, companyId]);

  useEffect(() => {
    setLoadingRevisions(true);
    refetchRevisions().finally(() => setLoadingRevisions(false));
  }, [refetchRevisions]);

  /** Live sync — refetch when any revision on this tenant changes (INSERT/UPDATE/DELETE). */
  useEffect(() => {
    const slideIds = new Set(slides.map((s) => s.id));
    if (slideIds.size === 0) return;

    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    const connect = async () => {
      try { await ensureRealtimeAuth(); } catch { /* fall back to manual refetch */ }
      if (!mounted) return;
      channel = supabase
        .channel(`revisions:${post.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'revisions', filter: `tenant_id=eq.${companyId}` },
          (payload: RealtimePostgresChangesPayload<{ asset_id: string }>) => {
            const rec = payload as unknown as {
              new?: Record<string, unknown>;
              old?: Record<string, unknown>;
            };
            const assetId = (rec.new?.asset_id ?? rec.old?.asset_id) as string | undefined;
            if (assetId && slideIds.has(assetId)) {
              void refetchRevisions();
            }
          },
        )
        .subscribe();
    };
    void connect();

    return () => { mounted = false; if (channel) supabase.removeChannel(channel); };
  }, [post.id, companyId, slides, refetchRevisions]);

  function handleResolveToggle(revision: Revision) {
    startTransition(async () => {
      const res = await setRevisionResolved(revision.id, companyId, !revision.resolvedAt);
      if (res.success) await refetchRevisions();
    });
  }

  function handleEditRevision(revisionId: string, nextComment: string) {
    const target = revisions.find((r) => r.id === revisionId);
    if (!target) return;
    startTransition(async () => {
      const res = await editRevision({
        revisionId,
        tenantId: companyId,
        comment: nextComment,
        videoMetadata: target.videoMetadata,
        imageMetadata: target.imageMetadata,
      });
      if (res.success) await refetchRevisions();
    });
  }

  function handleDeleteRevision(revisionId: string) {
    startTransition(async () => {
      const res = await deleteRevision(revisionId, companyId);
      if (res.success) await refetchRevisions();
    });
  }

  useEffect(() => {
    setActiveImageAspect(IMAGE_ASPECT_NOTE_TYPES[0]);
  }, [post.id]);

  useEffect(() => {
    setRevisionCommentTarget('whole');
    setActiveSlideIdx(0);
    setPins([]);
    setPinMode(false);
  }, [post.id]);

  /** Clear pins/pin-mode when the annotated slide changes or the hero moves to a video. */
  useEffect(() => {
    setPins([]);
    setPinMode(false);
  }, [clampedIdx]);

  const validPins = useMemo(
    () => pins.filter((p) => p.note.trim().length > 0),
    [pins],
  );

  function handleHeroPinClick(e: React.MouseEvent<HTMLElement>) {
    if (!pinMode || heroIsVideo || !activeSlide) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return;
    setPins((prev) => [
      ...prev,
      { xPct: Math.round(xPct * 10) / 10, yPct: Math.round(yPct * 10) / 10, note: '', slideIndex: activeSlide.slideIndex },
    ]);
  }

  function handleAddRevision() {
    if (!revisionAnchorSlide || slides.length === 0) return;

    const pinnedSlide =
      !composerIsVideo && validPins.length > 0 && activeSlide
        ? activeSlide
        : null;

    if (composerIsVideo) {
      if (!comment.trim()) return;
      if (videoType === 'time_range' && (!startTime.trim() || !endTime.trim())) return;
    } else {
      const aspects = pickNonEmptyAspectNotes(aspectNotes);
      const ir = imageRefs.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), description: r.description.trim() }));
      if (!comment.trim() && Object.keys(aspects).length === 0 && ir.length === 0 && validPins.length === 0) return;
    }

    const videoMeta: VideoRevisionMeta | null = composerIsVideo ? {
      revisionType: videoType,
      startTime:  videoType === 'time_range' ? startTime.trim() : undefined,
      endTime:    videoType === 'time_range' ? endTime.trim()   : undefined,
      references: videoRefs.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), description: r.description.trim() })),
    } : null;

    const imageMeta: ImageRevisionMeta | null = !composerIsVideo ? (() => {
      const aspects = pickNonEmptyAspectNotes(aspectNotes);
      const references = imageRefs.filter((r) => r.url.trim()).map((r) => ({ url: r.url.trim(), description: r.description.trim() }));
      const payload: ImageRevisionMeta = {};
      if (Object.keys(aspects).length > 0) payload.aspectNotes = aspects;
      if (references.length > 0) payload.references = references;
      if (validPins.length > 0) payload.pins = validPins;
      return Object.keys(payload).length > 0 ? payload : null;
    })() : null;

    // Pinned image revisions anchor to the annotated slide; otherwise honor the target selector.
    const whole = revisionCommentTarget === 'whole' && !pinnedSlide;
    const targetSlide = pinnedSlide ?? (whole ? slides[0] : slides[revisionCommentTarget as number]);
    if (!targetSlide) return;

    startTransition(async () => {
      const result = await addRevision({
        postId: post.id,
        tenantId: companyId,
        anchorAssetId: targetSlide.id,
        slideIndex: whole ? null : targetSlide.slideIndex,
        comment: comment.trim(),
        videoMetadata: videoMeta,
        imageMetadata: imageMeta,
      });
      if (result.success) {
        setComment('');
        setVideoType('full'); setStartTime(''); setEndTime('');
        setVideoRefs([{ url: '', description: '' }]);
        setAspectNotes(createEmptyAspectNotes());
        setImageRefs([{ url: '', description: '' }]);
        setPins([]);
        setPinMode(false);
        const updated = await fetchRevisionsForPost(post.id, companyId);
        setRevisions(updated);
        onStatusChange?.(post.id, 'revision');
      }
    });
  }

  function captureVideoTime(target: 'start' | 'end') {
    const v = heroVideoRef.current;
    if (!v) return;
    const tc = secondsToTimecode(v.currentTime);
    if (target === 'start') setStartTime(tc);
    else setEndTime(tc);
  }

  const videoTimeOk = videoType !== 'time_range' || (startTime.trim().length > 0 && endTime.trim().length > 0);
  const imageHasRefs = imageRefs.some((r) => r.url.trim());
  const imageHasAspects = Object.keys(pickNonEmptyAspectNotes(aspectNotes)).length > 0;
  const imageHasPins = validPins.length > 0;
  const hasRevisionSubstance = composerIsVideo
    ? comment.trim().length > 0 && videoTimeOk
    : comment.trim().length > 0 || imageHasAspects || imageHasRefs || imageHasPins;

  const canSubmit = hasRevisionSubstance;

  function handleSubmitRevision() {
    if (isPending || !hasRevisionSubstance) return;
    if (composerIsVideo && videoType === 'time_range' && (!startTime.trim() || !endTime.trim())) {
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
                {post.title}
              </h3>
              <ApprovalBadge status={post.status} size="md" />
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

            {/* ── Hero carousel preview ── */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.12em]">{t('assetPreview')}</p>
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 1px 0 0 rgba(255,255,255,0.07)',
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-20 pointer-events-none" />
                <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/12 via-transparent to-transparent z-20 pointer-events-none" />

                <div
                  ref={carouselViewportRef}
                  className="relative h-52 w-full overflow-hidden bg-black/40 touch-pan-y"
                >
                  <motion.div
                    className={cn(
                      'flex h-full',
                      slides.length > 1 && 'cursor-grab active:cursor-grabbing',
                    )}
                    style={{
                      width: Math.max(slides.length, 1) * carouselW,
                      touchAction: slides.length > 1 ? 'pan-y' : undefined,
                    }}
                    animate={{ x: -clampedIdx * carouselW }}
                    transition={drawerSpring}
                    drag={slides.length > 1 && !pinMode ? 'x' : false}
                    dragConstraints={{
                      left: -Math.max(0, slides.length - 1) * carouselW,
                      right: 0,
                    }}
                    dragElastic={0.06}
                    onDragEnd={(_, info) => {
                      const n = slides.length;
                      if (n < 2 || carouselW < 8) return;
                      const threshold = Math.min(56, carouselW * 0.14);
                      const impulse = info.offset.x + info.velocity.x * 0.16;
                      if (impulse < -threshold) {
                        setActiveSlideIdx((i) => Math.min(i + 1, n - 1));
                      } else if (impulse > threshold) {
                        setActiveSlideIdx((i) => Math.max(i - 1, 0));
                      }
                    }}
                  >
                    {slides.map((s, slideIdx) => {
                      const isActive = slideIdx === clampedIdx;
                      const pinnable = isActive && pinMode && s.type !== 'video';
                      return (
                        <div
                          key={s.id}
                          onClick={pinnable ? handleHeroPinClick : undefined}
                          className={cn(
                            'relative h-full shrink-0 flex items-center justify-center',
                            pinnable && 'cursor-crosshair',
                          )}
                          style={{ width: carouselW, minHeight: '100%' }}
                        >
                          {s.type === 'video' ? (
                            isActive ? (
                              <video
                                key={s.url}
                                ref={heroVideoRef}
                                src={s.url}
                                controls
                                className="max-h-full w-full max-w-full object-contain"
                                preload="metadata"
                                playsInline
                              />
                            ) : (
                              <div
                                className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/45 px-3 text-center"
                                aria-hidden
                              >
                                <PlayCircle className="w-11 h-11 text-white/35" />
                                <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                                  {t('videoSlideCue', { n: slideIdx + 1 })}
                                </span>
                              </div>
                            )
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.thumbnailUrl ?? s.url}
                              alt={s.title}
                              className="max-h-full w-full max-w-full object-contain bg-black/30 pointer-events-none"
                            />
                          )}

                          {/* Draft pin markers for the active image */}
                          {isActive && s.type !== 'video' &&
                            pins.map((pin, pinIdx) => (
                              <button
                                key={pinIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPins((prev) => prev.filter((_, k) => k !== pinIdx));
                                }}
                                aria-label={t('removePinAria', { n: pinIdx + 1 })}
                                className="absolute z-30 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-lg transition-transform hover:scale-110"
                                style={{
                                  left: `${pin.xPct}%`,
                                  top: `${pin.yPct}%`,
                                  background: 'rgba(156,112,178,0.95)',
                                  border: '1.5px solid rgba(255,255,255,0.9)',
                                }}
                              >
                                {pinIdx + 1}
                              </button>
                            ))}
                        </div>
                      );
                    })}
                  </motion.div>
                </div>

                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label={t('carouselPrev')}
                      onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-2xl flex items-center justify-center text-white/80 hover:text-white transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(16px) saturate(180%)',
                      }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('carouselNext')}
                      onClick={() => setActiveSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-2xl flex items-center justify-center text-white/80 hover:text-white transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(16px) saturate(180%)',
                      }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-30">
                      {slides.map((s, dotIdx) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-current={dotIdx === clampedIdx}
                          aria-label={t('carouselDot', { n: dotIdx + 1 })}
                          onClick={() => setActiveSlideIdx(dotIdx)}
                          className={cn(
                            'w-2 h-2 rounded-full transition-all',
                            dotIdx === clampedIdx ? 'bg-white/85 scale-110' : 'bg-white/25 hover:bg-white/40',
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {activeSlide && (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#9c70b2] hover:text-[#b48dc8] transition-colors"
                  >
                    {heroIsVideo ? <PlayCircle className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {t('openFullAsset')}
                  </button>
                )}
                {!heroIsVideo && activeSlide && (
                  <button
                    type="button"
                    onClick={() => setPinMode((p) => !p)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-colors press-scale',
                      pinMode ? 'text-[#b48dc8]' : 'text-white/40 hover:text-white/65',
                    )}
                    style={pinMode ? {
                      background: 'rgba(156,112,178,0.14)',
                      border: '1px solid rgba(156,112,178,0.3)',
                    } : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {pinMode ? t('pinModeOn') : t('pinModeOff')}
                  </button>
                )}
              </div>

              {/* Pin annotation notes */}
              {!heroIsVideo && pins.length > 0 && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(156,112,178,0.06)', border: '1px solid rgba(156,112,178,0.18)' }}>
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#b48dc8]">
                    <Crosshair className="w-3 h-3" />
                    {t('pinNotesHeading', { count: pins.length })}
                  </p>
                  {pins.map((pin, pinIdx) => (
                    <div key={pinIdx} className="flex items-start gap-2">
                      <span
                        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: 'rgba(156,112,178,0.9)' }}
                      >
                        {pinIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={pin.note}
                        onChange={(e) =>
                          setPins((prev) => prev.map((p, k) => (k === pinIdx ? { ...p, note: e.target.value } : p)))
                        }
                        placeholder={t('pinNotePlaceholder')}
                        className="flex-1 rounded-lg px-2.5 py-1.5 text-xs text-white/85 placeholder-white/25 outline-none"
                        style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setPins((prev) => prev.filter((_, k) => k !== pinIdx))}
                        aria-label={t('removePinAria', { n: pinIdx + 1 })}
                        className="mt-1 text-white/25 hover:text-rose-400 transition-colors press-scale"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!heroIsVideo && pinMode && pins.length === 0 && (
                <p className="text-[11px] text-white/35 leading-relaxed">{t('pinModeHint')}</p>
              )}
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
                  {revisions.map((r) => (
                    <RevisionCard
                      key={r.id}
                      revision={r}
                      slides={slides}
                      canApprove={canApprove}
                      currentUserId={currentUserId}
                      canDeleteAny={canDeleteCreative}
                      onResolveToggle={handleResolveToggle}
                      onEdit={handleEditRevision}
                      onDelete={handleDeleteRevision}
                      busy={isPending}
                    />
                  ))}
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
              {slides.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 pb-0.5">
                  <Layers className="w-3.5 h-3.5 text-[#bea042]/85 shrink-0" aria-hidden />
                  <label htmlFor="revision-comment-target" className="text-[10px] font-semibold text-white/30 uppercase tracking-wider shrink-0">
                    {t('commentTargetLabel')}
                  </label>
                  <select
                    id="revision-comment-target"
                    value={revisionCommentTarget === 'whole' ? 'whole' : String(revisionCommentTarget)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'whole') {
                        setRevisionCommentTarget('whole');
                      } else {
                        const idx = parseInt(v, 10);
                        if (!Number.isNaN(idx)) {
                          setRevisionCommentTarget(idx);
                          setActiveSlideIdx(idx);
                        }
                      }
                    }}
                    className="text-xs rounded-xl px-2.5 py-1.5 min-w-[10rem] bg-white/[0.06] border border-white/[0.1] text-white/82 outline-none focus-visible:ring-1 focus-visible:ring-[#9c70b2]/55"
                  >
                    <option value="whole">{t('commentWholePost')}</option>
                    {slides.map((s, slideArrIdx) => (
                      <option key={s.id} value={String(slideArrIdx)}>
                        {t('commentSlideOption', { n: slideArrIdx + 1 })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Textarea */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={composerIsVideo ? t('placeholderVideoComment') : t('placeholderImageComment')}
                rows={2}
                className="w-full bg-transparent text-sm text-white/88 placeholder-white/22 outline-none resize-none leading-relaxed"
                style={{ minHeight: 48, maxHeight: 100 }}
              />

              {/* Structured revision fields (collapsed by default) */}
              <AnimatePresence initial={false}>
                {revisionDetailsOpen && composerIsVideo && (
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
                            {heroIsVideo && (
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => captureVideoTime('start')}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-cyan-200/90 transition-colors hover:text-cyan-100 press-scale"
                                  style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)' }}
                                >
                                  <Crosshair className="w-3 h-3" />
                                  {t('captureStart')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => captureVideoTime('end')}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-cyan-200/90 transition-colors hover:text-cyan-100 press-scale"
                                  style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)' }}
                                >
                                  <Crosshair className="w-3 h-3" />
                                  {t('captureEnd')}
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <ReferenceFields references={videoRefs} onChange={setVideoRefs} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {revisionDetailsOpen && !composerIsVideo && (
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
                  disabled={isPending || post.status === 'approved'}
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

              <VisionReviewPanel
                postId={post.id}
                companyId={companyId}
                hasImageSlide={post.slides.some((s) => s.type === 'image')}
              />

              {canApprove && post.status === 'approved' && post.platform === 'instagram' ? (
                <div className="mt-3">
                  <PublishNowButton
                    post={post}
                    companyId={companyId}
                    onPublished={(_postId: string, igMediaId: string) => onPublished?.(post.id, igMediaId)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
  );

  const approveDialog = (
      <Dialog
        open={canApprove && showApproveConfirm}
        onOpenChange={(open) => setShowApproveConfirm(open)}
      >
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
                  const result = await updateAssetStatus(post.id, 'approved', companyId);
                  if (result.success) {
                    triggerConfetti();
                    const g = result.gamification;
                    if (g?.newAchievements?.length) {
                      g.newAchievements.forEach((key, i) => {
                        const def = ACHIEVEMENT_MAP.get(key);
                        if (!def) return;
                        setTimeout(() => {
                          triggerAchievementToast({
                            icon: def.icon,
                            achievementKey: key,
                            xp: def.xp,
                          });
                        }, i * 800);
                      });
                    }
                    if (g?.leveledUp) {
                      setTimeout(
                        () => triggerLevelUp(g.leveledUp!),
                        (g.newAchievements?.length ?? 0) * 800 + 500,
                      );
                    }
                    onStatusChange?.(post.id, 'approved');
                    setShowApproveConfirm(false);
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
                const result = await deleteCreativePost(post.id, companyId);
                if (result.success) {
                  setShowDeleteConfirm(false);
                  onPostDeleted?.(post.id);
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

  const lightbox = (
    <AnimatePresence>
      {lightboxOpen && activeSlide ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 md:p-8"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label={t('closeFullAsset')}
            className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-white/[0.06] p-2 text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={drawerSpring}
            className="max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {heroIsVideo ? (
              <video
                src={activeSlide.url}
                controls
                autoPlay
                playsInline
                className="max-h-[88vh] max-w-[92vw] rounded-2xl"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeSlide.url}
                alt={post.title}
                className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain"
              />
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      {portalReady ? createPortal(overlay, document.body) : null}
      {portalReady ? createPortal(lightbox, document.body) : null}
      {approveDialog}
      {deleteDialog}
    </>
  );
}
