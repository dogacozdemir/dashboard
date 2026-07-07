'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar,
  Zap,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  Phone,
  CheckCircle2,
  Clock,
  Circle,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';
import { createCalendarEvent } from '../actions/fetchMilestones';
import {
  socialDotVisual,
  socialIconRowClass,
  STORY_DOT_GRADIENT,
} from '@/features/calendar/social-visuals';
import type {
  CalendarMilestone,
  CalendarEvent,
  DayItem,
  SocialPlatform,
  CreativeContentFormat,
} from '../types';

const DOT_COLORS: Record<DayItem['color'], string> = {
  indigo: 'bg-indigo-400',
  cyan: 'bg-cyan-400',
  violet: 'bg-violet-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
};

interface Props {
  companyId: string;
  milestones: CalendarMilestone[];
  events: CalendarEvent[];
  creatives: Array<{ id: string; title: string; contentFormat: CreativeContentFormat | null }>;
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDayItems(
  milestones: CalendarMilestone[],
  events: CalendarEvent[],
  year: number,
  month: number,
  viewMode: 'ops' | 'social',
): Record<number, DayItem[]> {
  const result: Record<number, DayItem[]> = {};

  const add = (day: number, item: DayItem) => {
    result[day] = [...(result[day] ?? []), item];
  };

  if (viewMode === 'ops') {
    for (const m of milestones) {
      if (!m.etaDate) continue;
      const d = new Date(m.etaDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        add(d.getDate(), { type: 'milestone', id: m.id, title: m.title, color: 'violet', data: m });
      }
    }

    for (const e of events) {
      const d = new Date(e.eventDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const color: DayItem['color'] = e.eventType === 'strategy_call' ? 'indigo' : 'cyan';
        const contentFormat =
          e.eventType === 'social_post' ? (e.contentFormat ?? 'feed_post') : undefined;
        add(d.getDate(), {
          type: e.eventType,
          id: e.id,
          title: e.title,
          color,
          contentFormat,
          data: e,
        });
      }
    }
    return result;
  }

  for (const e of events) {
    if (e.eventType !== 'social_post') continue;
    const d = new Date(e.eventDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const cf = e.contentFormat ?? 'feed_post';
      const color: DayItem['color'] =
        cf === 'carousel' ? 'amber' : cf === 'reel' ? 'violet' : cf === 'story' ? 'violet' : 'cyan';
      add(d.getDate(), {
        type: 'social_post',
        id: e.id,
        title: e.title,
        color,
        contentFormat: cf,
        data: e,
      });
    }
  }

  return result;
}

function CalendarDot({ item, viewMode }: { item: DayItem; viewMode: 'ops' | 'social' }) {
  if (viewMode === 'social' && item.type === 'social_post') {
    const ev = item.data as CalendarEvent;
    const fmt = item.contentFormat ?? ev.contentFormat ?? 'feed_post';
    const vis = socialDotVisual(fmt);
    if (vis.kind === 'gradient') {
      return (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0 ring-1 ring-white/15 shadow-sm"
          style={{ background: vis.gradient }}
        />
      );
    }
    return <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', vis.className)} />;
  }
  return <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOT_COLORS[item.color])} />;
}

function SidebarMarker({
  viewMode,
  contentFormat,
  color,
}: {
  viewMode: 'ops' | 'social';
  contentFormat?: CreativeContentFormat | null;
  color: DayItem['color'];
}) {
  if (viewMode === 'social') {
    const vis = socialDotVisual(contentFormat ?? 'feed_post');
    if (vis.kind === 'gradient') {
      return (
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0 ring-1 ring-white/15"
          style={{ background: vis.gradient }}
        />
      );
    }
    return <span className={cn('w-2 h-2 rounded-full shrink-0', vis.className)} />;
  }
  return <span className={cn('w-2 h-2 rounded-full shrink-0', DOT_COLORS[color])} />;
}

function ViewModeSwitch({
  value,
  onChange,
}: {
  value: 'ops' | 'social';
  onChange: (v: 'ops' | 'social') => void;
}) {
  const t = useTranslations('Features.Calendar');
  return (
    <div
      role="tablist"
      aria-label={`${t('viewModeOps')} · ${t('viewModeSocial')}`}
      className="relative flex h-9 min-w-[11.5rem] rounded-xl bg-white/[0.04] p-1 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)]"
    >
      <motion.div
        className="pointer-events-none absolute top-1 bottom-1 z-0 w-[calc(50%-6px)] rounded-lg bg-white/[0.12] backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        initial={false}
        animate={{ left: value === 'ops' ? 4 : 'calc(50% + 2px)' }}
        transition={{ type: 'spring', stiffness: 440, damping: 34 }}
      />
      {(['ops', 'social'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'relative z-10 flex-1 rounded-lg text-[11px] font-semibold tracking-wide transition-colors',
            value === mode ? 'text-white/90' : 'text-white/35 hover:text-white/55',
          )}
        >
          {mode === 'ops' ? t('viewModeOps') : t('viewModeSocial')}
        </button>
      ))}
    </div>
  );
}

export function MilestoneCalendar({ companyId, milestones, events: initialEvents, creatives }: Props) {
  const today = new Date();
  const locale = useLocale();
  const t = useTranslations('Features.Calendar');

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [viewMode, setViewMode] = useState<'ops' | 'social'>('ops');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<DayItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    setSelectedDay(null);
    setSelectedItem(null);
  }, [viewMode]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayItems = useMemo(
    () => buildDayItems(milestones, events, year, month, viewMode),
    [milestones, events, year, month, viewMode],
  );

  const selectedDayItems = selectedDay ? (dayItems[selectedDay] ?? []) : [];

  const upcomingItems = useMemo(() => {
    const cutoff = isoDateLocal(new Date());
    if (viewMode === 'ops') {
      const ms = milestones
        .filter((m) => m.etaDate && m.etaDate >= cutoff)
        .slice(0, 3)
        .map((m) => ({
          kind: 'milestone' as const,
          title: m.title,
          date: m.etaDate!,
          color: 'violet' as const,
          contentFormat: null as CreativeContentFormat | null,
        }));
      const evs = events
        .filter((e) => e.eventDate >= cutoff)
        .slice(0, 3)
        .map((e) => ({
          kind: e.eventType as 'strategy_call' | 'social_post',
          title: e.title,
          date: e.eventDate,
          color: (e.eventType === 'strategy_call' ? 'indigo' : 'cyan') as DayItem['color'],
          contentFormat:
            e.eventType === 'social_post' ? (e.contentFormat ?? 'feed_post') : null,
        }));
      return [...ms, ...evs].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
    }

    const futureSocial = events
      .filter((e) => e.eventType === 'social_post' && e.eventDate >= cutoff)
      .sort(
        (a, b) =>
          a.eventDate.localeCompare(b.eventDate) || (a.eventTime ?? '').localeCompare(b.eventTime ?? ''),
      );
    const firstDate = futureSocial[0]?.eventDate;
    if (!firstDate) return [];
    return futureSocial
      .filter((e) => e.eventDate === firstDate)
      .map((e) => ({
        kind: 'social_post' as const,
        title: e.title,
        date: e.eventDate,
        color: 'cyan' as const,
        contentFormat: e.contentFormat ?? 'feed_post',
      }));
  }, [viewMode, milestones, events]);

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
    setSelectedDay(null);
    setSelectedItem(null);
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
    setSelectedDay(null);
    setSelectedItem(null);
  }

  const fmtShort = (dateStr: string) =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' });

  const nextSocialDayIso = upcomingItems[0]?.date;
  const nextSocialDayFmt =
    viewMode === 'social' && upcomingItems.length > 0 && nextSocialDayIso
      ? new Date(nextSocialDayIso + 'T12:00:00').toLocaleDateString(locale, {
          weekday: 'short',
          month: 'long',
          day: 'numeric',
        })
      : null;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <GlassCard padding="none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] gap-4">
              <button
                type="button"
                onClick={prevMonth}
                className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <h3 className="text-sm font-semibold text-white/80 text-center flex-1 min-w-0">
                {t(`month${month}`)} {year}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <ViewModeSwitch value={viewMode} onChange={setViewMode} />
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium hover:bg-indigo-500/25 transition-colors backdrop-blur-sm"
                >
                  <Plus className="w-3 h-3" />
                  {t('add')}
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-white/[0.04]">
              {Array.from({ length: 7 }, (_, i) => (
                <div
                  key={i}
                  className="py-2 text-center text-[10px] font-semibold text-white/25 uppercase tracking-wider"
                >
                  {t(`weekday${i}`)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 border-b border-r border-white/[0.03]" />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const isToday =
                  day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const items = dayItems[day] ?? [];
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setSelectedDay(isSelected ? null : day);
                      setSelectedItem(null);
                    }}
                    className={cn(
                      'h-16 flex flex-col items-center pt-2 pb-1 border-b border-r border-white/[0.03] transition-colors',
                      isSelected
                        ? 'bg-indigo-500/10'
                        : items.length > 0
                          ? 'hover:bg-white/[0.03]'
                          : 'hover:bg-white/[0.02]',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center mb-1',
                        isToday
                          ? 'bg-indigo-500 text-white'
                          : isSelected
                            ? 'text-indigo-300'
                            : 'text-white/50',
                      )}
                    >
                      {day}
                    </span>
                    <div className="flex gap-0.5 flex-wrap justify-center px-0.5">
                      {items.slice(0, 4).map((item) => (
                        <CalendarDot key={item.id} item={item} viewMode={viewMode} />
                      ))}
                      {items.length > 4 && (
                        <span className="text-[8px] text-white/25">+{items.length - 4}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <AnimatePresence>
            {selectedDay && selectedDayItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <GlassCard padding="none">
                  <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white/60">
                      {t('selectedHeading', {
                        month: t(`month${month}`),
                        day: selectedDay,
                        count: selectedDayItems.length,
                      })}
                    </h4>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {selectedDayItems.map((item) => (
                      <DayItemRow
                        key={item.id}
                        item={item}
                        viewMode={viewMode}
                        onSelect={setSelectedItem}
                      />
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedItem && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <ItemDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <GlassCard padding="md" className="backdrop-blur-xl border-white/10 shadow-lg shadow-black/30">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-3">
              {t('legendTitle')}
            </p>
            <div className="space-y-2.5">
              {viewMode === 'ops' ? (
                <>
                  {[
                    { dot: 'bg-indigo-400', labelKey: 'legendStrategyCall' as const, icon: Phone },
                    { dot: 'bg-cyan-400', labelKey: 'legendSocialPost' as const, icon: ImageIcon },
                    { dot: 'bg-violet-400', labelKey: 'legendMilestone' as const, icon: Zap },
                  ].map(({ dot, labelKey, icon: Icon }) => (
                    <div key={labelKey} className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', dot)} />
                      <Icon className="w-3 h-3 text-white/30" />
                      <span className="text-xs text-white/40">{t(labelKey)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { key: 'legendStory', gradient: true },
                    { key: 'legendFeedPost', cls: 'bg-cyan-400' },
                    { key: 'legendCarousel', cls: 'bg-amber-400' },
                    { key: 'legendReel', cls: 'bg-violet-400' },
                  ].map((row) => (
                    <div key={row.key} className="flex items-center gap-2">
                      {row.gradient ? (
                        <span
                          className="w-2 h-2 rounded-full ring-1 ring-white/15 shrink-0"
                          style={{ background: STORY_DOT_GRADIENT }}
                        />
                      ) : (
                        <span className={cn('w-2 h-2 rounded-full shrink-0', row.cls)} />
                      )}
                      <ImageIcon className="w-3 h-3 text-white/30" />
                      <span className="text-xs text-white/40">{t(row.key)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </GlassCard>

          <GlassCard padding="none" className="backdrop-blur-xl border-white/10 shadow-lg shadow-black/30">
            <div className="px-5 py-4 border-b border-white/[0.06] space-y-1">
              <h3 className="text-sm font-semibold text-white/80">
                {viewMode === 'social' ? t('nextPostingDay') : t('upcomingTitle')}
              </h3>
              {viewMode === 'social' && nextSocialDayFmt && (
                <p className="text-[11px] text-white/45 font-medium">{nextSocialDayFmt}</p>
              )}
            </div>

            {upcomingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center px-5">
                <Calendar className="w-7 h-7 text-white/10" />
                <p className="text-sm text-white/30">{t('upcomingEmpty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {upcomingItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <SidebarMarker
                      viewMode={viewMode}
                      contentFormat={item.contentFormat}
                      color={item.color}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/70 truncate">{item.title}</p>
                      {viewMode === 'ops' && (
                        <p className="text-[10px] text-white/30 mt-0.5">{fmtShort(item.date)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AddEventModal
            companyId={companyId}
            creatives={creatives}
            onClose={() => setShowAddModal(false)}
            onCreated={(newEvent) => {
              setEvents((prev) => [...prev, newEvent]);
              setShowAddModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function DayItemRow({
  item,
  viewMode,
  onSelect,
}: {
  item: DayItem;
  viewMode: 'ops' | 'social';
  onSelect: (item: DayItem) => void;
}) {
  const t = useTranslations('Features.Calendar');
  const icons = { milestone: Zap, strategy_call: Phone, social_post: ImageIcon };
  const Icon = icons[item.type];

  const color =
    item.type === 'social_post' && viewMode === 'social'
      ? socialIconRowClass((item.data as CalendarEvent).contentFormat ?? item.contentFormat)
      : {
          milestone: 'text-violet-400 bg-violet-500/10 border border-violet-500/15',
          strategy_call: 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/15',
          social_post: 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/15',
        }[item.type];

  const typeLabel =
    item.type === 'milestone'
      ? t('typeMilestone')
      : item.type === 'strategy_call'
        ? t('typeStrategyCall')
        : t('typeSocialPost');

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
    >
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 truncate">{item.title}</p>
        <p className="text-[10px] text-white/30 mt-0.5">{typeLabel}</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
    </button>
  );
}

function ItemDetailPanel({ item, onClose }: { item: DayItem; onClose: () => void }) {
  const t = useTranslations('Features.Calendar');
  const tPlat = useTranslations('Features.Creative');

  const platformLabel = (p: SocialPlatform) =>
    ({
      meta: tPlat('platformMeta'),
      google: tPlat('platformGoogle'),
      tiktok: tPlat('platformTiktok'),
      instagram: tPlat('platformInstagram'),
      linkedin: tPlat('platformLinkedin'),
      x: tPlat('platformX'),
    })[p];

  if (item.type === 'social_post') {
    const ev = item.data as CalendarEvent;
    const fmt = ev.contentFormat ?? 'feed_post';
    const accent = socialIconRowClass(fmt);
    return (
      <GlassCard padding="none" className="border border-cyan-500/15 backdrop-blur-xl border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', accent)}>
              <ImageIcon className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-white/80">{ev.title}</h4>
          </div>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {ev.platform && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">
                {t('detailPlatform')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
                {platformLabel(ev.platform)}
              </span>
            </div>
          )}
          {ev.caption && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">
                {t('detailCaption')}
              </p>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 backdrop-blur-sm">
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{ev.caption}</p>
              </div>
            </div>
          )}
          {ev.creativePostId && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">
                {t('detailCreativeAsset')}
              </p>
              <a
                href={ev.creativeUrl ?? '/creative'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-indigo-500/30 transition-colors group backdrop-blur-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/70 truncate">
                    {ev.creativeTitle ?? t('viewCreativeFallback')}
                  </p>
                  <p className="text-[10px] text-white/30">{t('openCreativeHint')}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-white/25 group-hover:text-indigo-400 transition-colors" />
              </a>
            </div>
          )}
          {ev.description && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{t('detailNotes')}</p>
              <p className="text-sm text-white/50 leading-relaxed">{ev.description}</p>
            </div>
          )}
        </div>
      </GlassCard>
    );
  }

  if (item.type === 'strategy_call') {
    const ev = item.data as CalendarEvent;
    return (
      <GlassCard padding="none" className="border border-indigo-500/20 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-semibold text-white/80">{ev.title}</h4>
          </div>
          <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-4 text-xs text-white/50">
            {ev.eventTime && <span>🕐 {ev.eventTime}</span>}
            {ev.durationMin != null && <span>⏱ {t('durationMin', { n: ev.durationMin })}</span>}
          </div>
          {ev.description && <p className="text-sm text-white/60 leading-relaxed">{ev.description}</p>}
          {ev.meetingUrl && (
            <a
              href={ev.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm hover:bg-indigo-500/20 transition-colors backdrop-blur-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('joinMeeting')}
            </a>
          )}
        </div>
      </GlassCard>
    );
  }

  const ms = item.data as CalendarMilestone;
  const statusIcons = { completed: CheckCircle2, 'in-progress': Clock, upcoming: Circle };
  const StatusIcon = statusIcons[ms.status];
  const statusLabel =
    ms.status === 'completed'
      ? t('msCompleted')
      : ms.status === 'in-progress'
        ? t('msInProgress')
        : t('msUpcoming');

  return (
    <GlassCard padding="none" className="border border-violet-500/20 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-400" />
          <h4 className="text-sm font-semibold text-white/80">{ms.title}</h4>
        </div>
        <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4 text-violet-400" />
          <span className="text-xs text-white/50">{statusLabel}</span>
          <span className="text-[10px] text-white/20">·</span>
          <span className="text-xs text-white/30 capitalize">{ms.category}</span>
        </div>
        {ms.description && <p className="text-sm text-white/60 leading-relaxed">{ms.description}</p>}
      </div>
    </GlassCard>
  );
}

interface AddEventModalProps {
  companyId: string;
  creatives: Array<{ id: string; title: string; contentFormat: CreativeContentFormat | null }>;
  onClose: () => void;
  onCreated: (event: CalendarEvent) => void;
}

function AddEventModal({ companyId, creatives, onClose, onCreated }: AddEventModalProps) {
  const t = useTranslations('Features.Calendar');
  const tPlat = useTranslations('Features.Creative');

  const platformLabel = (p: SocialPlatform) =>
    ({
      meta: tPlat('platformMeta'),
      google: tPlat('platformGoogle'),
      tiktok: tPlat('platformTiktok'),
      instagram: tPlat('platformInstagram'),
      linkedin: tPlat('platformLinkedin'),
      x: tPlat('platformX'),
    })[p];

  const [eventType, setEventType] = useState<'strategy_call' | 'social_post'>('strategy_call');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [durationMin, setDurationMin] = useState('60');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [caption, setCaption] = useState('');
  const [creativePostId, setCreativePostId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!title.trim() || !eventDate) {
      setError(t('errorTitleDate'));
      return;
    }
    startTransition(async () => {
      const result = await createCalendarEvent(companyId, {
        eventType,
        title: title.trim(),
        description: description.trim() || undefined,
        eventDate,
        eventTime: eventTime || undefined,
        durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
        meetingUrl: meetingUrl.trim() || undefined,
        platform: eventType === 'social_post' ? platform : undefined,
        caption: eventType === 'social_post' ? caption.trim() || undefined : undefined,
        creativePostId:
          eventType === 'social_post' && creativePostId ? creativePostId : undefined,
      });

      if (!result.success) {
        setError(result.error ?? t('errorCreateFailed'));
        return;
      }

      const linked = creatives.find((c) => c.id === creativePostId);
      const newEvent: CalendarEvent = {
        id: crypto.randomUUID(),
        eventType,
        title: title.trim(),
        description: description.trim() || null,
        eventDate,
        eventTime: eventTime || null,
        durationMin: durationMin ? parseInt(durationMin, 10) : null,
        meetingUrl: meetingUrl.trim() || null,
        platform: eventType === 'social_post' ? platform : null,
        caption: eventType === 'social_post' ? caption.trim() || null : null,
        creativePostId: eventType === 'social_post' && creativePostId ? creativePostId : null,
        creativeTitle:
          creatives.find((c) => c.id === creativePostId)?.title ?? null,
        creativeUrl: null,
        contentFormat:
          eventType === 'social_post' ? (linked?.contentFormat ?? null) : undefined,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };
      onCreated(newEvent);
    });
  }

  const PLATFORMS_SOCIAL: SocialPlatform[] = ['meta', 'google', 'tiktok', 'instagram', 'linkedin', 'x'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-md"
      >
        <GlassCard padding="none" className="border-white/10 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white/80">{t('modalTitle')}</h3>
            <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['strategy_call', 'modalStrategyCall', Phone],
                  ['social_post', 'modalSocialPost', ImageIcon],
                ] as const
              ).map(([type, labelKey, Icon]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventType(type)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors backdrop-blur-sm',
                    eventType === type
                      ? type === 'strategy_call'
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                        : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                      : 'bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/60',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(labelKey)}
                </button>
              ))}
            </div>

            {[
              {
                label: t('labelTitle'),
                value: title,
                setter: setTitle,
                placeholder:
                  eventType === 'strategy_call' ? t('phStrategyTitle') : t('phSocialTitle'),
              },
              {
                label: t('labelNotes'),
                value: description,
                setter: setDescription,
                placeholder: t('phNotes'),
              },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label} className="space-y-1">
                <label className="text-xs text-white/40">{label}</label>
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm placeholder-white/20 outline-none focus:border-indigo-500/40 transition-all"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-white/40">{t('labelDate')}</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-indigo-500/40 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">{t('labelTime')}</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-indigo-500/40 transition-all"
                />
              </div>
            </div>

            {eventType === 'strategy_call' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-white/40">{t('labelDurationMin')}</label>
                    <input
                      value={durationMin}
                      onChange={(e) => setDurationMin(e.target.value)}
                      type="number"
                      min="15"
                      step="15"
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-indigo-500/40 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">{t('labelMeetingUrl')}</label>
                  <input
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder={t('phMeetingUrl')}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm placeholder-white/20 outline-none focus:border-indigo-500/40 transition-all"
                  />
                </div>
              </>
            )}

            {eventType === 'social_post' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">{t('labelPlatform')}</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all"
                  >
                    {PLATFORMS_SOCIAL.map((val) => (
                      <option key={val} value={val}>
                        {platformLabel(val)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">{t('labelCaption')}</label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={3}
                    placeholder={t('phCaption')}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm placeholder-white/20 outline-none focus:border-cyan-500/40 transition-all resize-none"
                  />
                </div>
                {creatives.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-white/40">{t('labelCreativeOptional')}</label>
                    <select
                      value={creativePostId}
                      onChange={(e) => setCreativePostId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all"
                    >
                      <option value="">{t('noCreativeLinked')}</option>
                      {creatives.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 px-6 py-4 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.09] transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !title.trim() || !eventDate}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-colors disabled:opacity-40 backdrop-blur-sm"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {t('createEvent')}
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
