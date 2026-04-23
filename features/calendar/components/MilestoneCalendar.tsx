'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar, Zap, FileText, Globe, BarChart3,
  CheckCircle2, Clock, Circle, Phone, Image as ImageIcon, ExternalLink, Loader2
} from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';
import { createCalendarEvent } from '../actions/fetchMilestones';
import type { CalendarMilestone, CalendarEvent, DayItem, SocialPlatform } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DOT_COLORS: Record<DayItem['color'], string> = {
  indigo:  'bg-indigo-400',
  cyan:    'bg-cyan-400',
  violet:  'bg-violet-400',
  emerald: 'bg-emerald-400',
  amber:   'bg-amber-400',
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  meta:      'Meta',
  google:    'Google',
  tiktok:    'TikTok',
  instagram: 'Instagram',
  linkedin:  'LinkedIn',
  x:         'X (Twitter)',
};

interface Props {
  companyId: string;
  milestones: CalendarMilestone[];
  events: CalendarEvent[];
  creatives: Array<{ id: string; title: string }>;
}

function buildDayItems(
  milestones: CalendarMilestone[],
  events: CalendarEvent[],
  year: number,
  month: number
): Record<number, DayItem[]> {
  const result: Record<number, DayItem[]> = {};

  const add = (day: number, item: DayItem) => {
    result[day] = [...(result[day] ?? []), item];
  };

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
      add(d.getDate(), { type: e.eventType, id: e.id, title: e.title, color, data: e });
    }
  }

  return result;
}

export function MilestoneCalendar({ companyId, milestones, events: initialEvents, creatives }: Props) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedDay, setSelectedDay]  = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<DayItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayItems = buildDayItems(milestones, events, year, month);

  const selectedDayItems = selectedDay ? (dayItems[selectedDay] ?? []) : [];

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
    setSelectedItem(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
    setSelectedItem(null);
  }

  const upcomingItems = [
    ...milestones.filter((m) => m.etaDate && new Date(m.etaDate) >= today).slice(0, 3).map((m) => ({
      type: 'milestone' as const, title: m.title, date: m.etaDate!, color: 'violet' as const,
    })),
    ...events.filter((e) => new Date(e.eventDate) >= today).slice(0, 3).map((e) => ({
      type: e.eventType as 'strategy_call' | 'social_post',
      title: e.title,
      date: e.eventDate,
      color: (e.eventType === 'strategy_call' ? 'indigo' : 'cyan') as DayItem['color'],
    })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard padding="none">
            {/* Month nav */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <h3 className="text-sm font-semibold text-white/80">{MONTHS[month]} {year}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium hover:bg-indigo-500/25 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
                <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-white/[0.04]">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-[10px] font-semibold text-white/25 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 border-b border-r border-white/[0.03]" />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const isToday    = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const items      = dayItems[day] ?? [];
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    onClick={() => { setSelectedDay(isSelected ? null : day); setSelectedItem(null); }}
                    className={cn(
                      'h-16 flex flex-col items-center pt-2 pb-1 border-b border-r border-white/[0.03] transition-colors',
                      isSelected ? 'bg-indigo-500/10' : items.length > 0 ? 'hover:bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                    )}
                  >
                    <span className={cn(
                      'text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center mb-1',
                      isToday    ? 'bg-indigo-500 text-white' :
                      isSelected ? 'text-indigo-300' : 'text-white/50'
                    )}>
                      {day}
                    </span>
                    <div className="flex gap-0.5 flex-wrap justify-center px-0.5">
                      {items.slice(0, 4).map((item) => (
                        <span key={item.id} className={cn('w-1.5 h-1.5 rounded-full', DOT_COLORS[item.color])} />
                      ))}
                      {items.length > 4 && <span className="text-[8px] text-white/25">+{items.length - 4}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* Selected day detail */}
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
                      {MONTHS[month]} {selectedDay} — {selectedDayItems.length} item{selectedDayItems.length > 1 ? 's' : ''}
                    </h4>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {selectedDayItems.map((item) => (
                      <DayItemRow key={item.id} item={item} onSelect={setSelectedItem} />
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Item detail panel */}
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

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Legend */}
          <GlassCard padding="md">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-3">Legend</p>
            <div className="space-y-2.5">
              {[
                { dot: 'bg-indigo-400', label: 'Strategy Call', icon: Phone },
                { dot: 'bg-cyan-400',   label: 'Social Post',   icon: ImageIcon },
                { dot: 'bg-violet-400', label: 'Milestone',     icon: Zap },
              ].map(({ dot, label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', dot)} />
                  <Icon className="w-3 h-3 text-white/30" />
                  <span className="text-xs text-white/40">{label}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Upcoming */}
          <GlassCard padding="none">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white/80">Upcoming</h3>
            </div>

            {upcomingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center px-5">
                <Calendar className="w-7 h-7 text-white/10" />
                <p className="text-sm text-white/30">Nothing scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {upcomingItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', DOT_COLORS[item.color])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/70 truncate">{item.title}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Add Event Modal */}
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

// ─── Day item row ──────────────────────────────────────────────────────────────

function DayItemRow({ item, onSelect }: { item: DayItem; onSelect: (item: DayItem) => void }) {
  const icons = { milestone: Zap, strategy_call: Phone, social_post: ImageIcon };
  const Icon  = icons[item.type];
  const color = {
    milestone: 'text-violet-400 bg-violet-500/10',
    strategy_call: 'text-indigo-400 bg-indigo-500/10',
    social_post: 'text-cyan-400 bg-cyan-500/10',
  }[item.type];

  return (
    <button
      onClick={() => onSelect(item)}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
    >
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 truncate">{item.title}</p>
        <p className="text-[10px] text-white/30 capitalize mt-0.5">{item.type.replace('_', ' ')}</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
    </button>
  );
}

// ─── Item detail panel ─────────────────────────────────────────────────────────

function ItemDetailPanel({ item, onClose }: { item: DayItem; onClose: () => void }) {
  if (item.type === 'social_post') {
    const ev = item.data as CalendarEvent;
    return (
      <GlassCard padding="none" className="border border-cyan-500/20">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-white/80">{ev.title}</h4>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {ev.platform && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Platform</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
                {PLATFORM_LABELS[ev.platform]}
              </span>
            </div>
          )}
          {ev.caption && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Caption</p>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{ev.caption}</p>
              </div>
            </div>
          )}
          {ev.creativeId && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Creative Asset</p>
              <a
                href={ev.creativeUrl ?? '/creative'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-indigo-500/30 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/70 truncate">{ev.creativeTitle ?? 'View Creative'}</p>
                  <p className="text-[10px] text-white/30">Click to open in Creative Studio</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-white/25 group-hover:text-indigo-400 transition-colors" />
              </a>
            </div>
          )}
          {ev.description && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Notes</p>
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
      <GlassCard padding="none" className="border border-indigo-500/20">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-semibold text-white/80">{ev.title}</h4>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-4 text-xs text-white/50">
            {ev.eventTime && <span>🕐 {ev.eventTime}</span>}
            {ev.durationMin && <span>⏱ {ev.durationMin} min</span>}
          </div>
          {ev.description && <p className="text-sm text-white/60 leading-relaxed">{ev.description}</p>}
          {ev.meetingUrl && (
            <a
              href={ev.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm hover:bg-indigo-500/20 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Join Meeting
            </a>
          )}
        </div>
      </GlassCard>
    );
  }

  // Milestone
  const ms = item.data as CalendarMilestone;
  const statusIcons = { completed: CheckCircle2, 'in-progress': Clock, upcoming: Circle };
  const StatusIcon = statusIcons[ms.status];
  return (
    <GlassCard padding="none" className="border border-violet-500/20">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-400" />
          <h4 className="text-sm font-semibold text-white/80">{ms.title}</h4>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4 text-violet-400" />
          <span className="text-xs text-white/50 capitalize">{ms.status.replace('-', ' ')}</span>
          <span className="text-[10px] text-white/20">·</span>
          <span className="text-xs text-white/30 capitalize">{ms.category}</span>
        </div>
        {ms.description && <p className="text-sm text-white/60 leading-relaxed">{ms.description}</p>}
      </div>
    </GlassCard>
  );
}

// ─── Add Event Modal ───────────────────────────────────────────────────────────

interface AddEventModalProps {
  companyId: string;
  creatives: Array<{ id: string; title: string }>;
  onClose: () => void;
  onCreated: (event: CalendarEvent) => void;
}

function AddEventModal({ companyId, creatives, onClose, onCreated }: AddEventModalProps) {
  const [eventType, setEventType] = useState<'strategy_call' | 'social_post'>('strategy_call');
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [eventDate,   setEventDate]   = useState('');
  const [eventTime,   setEventTime]   = useState('');
  const [durationMin, setDurationMin] = useState('60');
  const [meetingUrl,  setMeetingUrl]  = useState('');
  const [platform,    setPlatform]    = useState<SocialPlatform>('instagram');
  const [caption,     setCaption]     = useState('');
  const [creativeId,  setCreativeId]  = useState('');
  const [isPending, startTransition]  = useTransition();
  const [error, setError]             = useState<string | null>(null);

  function handleSubmit() {
    if (!title.trim() || !eventDate) { setError('Title and date are required'); return; }
    startTransition(async () => {
      const result = await createCalendarEvent(companyId, {
        eventType,
        title:       title.trim(),
        description: description.trim() || undefined,
        eventDate,
        eventTime:   eventTime || undefined,
        durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
        meetingUrl:  meetingUrl.trim() || undefined,
        platform:    eventType === 'social_post' ? platform : undefined,
        caption:     eventType === 'social_post' ? caption.trim() || undefined : undefined,
        creativeId:  eventType === 'social_post' && creativeId ? creativeId : undefined,
      });

      if (!result.success) { setError(result.error ?? 'Failed to create event'); return; }

      const newEvent: CalendarEvent = {
        id:            crypto.randomUUID(),
        eventType,
        title:         title.trim(),
        description:   description.trim() || null,
        eventDate,
        eventTime:     eventTime || null,
        durationMin:   durationMin ? parseInt(durationMin, 10) : null,
        meetingUrl:    meetingUrl.trim() || null,
        platform:      eventType === 'social_post' ? platform : null,
        caption:       eventType === 'social_post' ? caption.trim() || null : null,
        creativeId:    eventType === 'social_post' && creativeId ? creativeId : null,
        creativeTitle: creatives.find((c) => c.id === creativeId)?.title ?? null,
        creativeUrl:   null,
        status:        'scheduled',
        createdAt:     new Date().toISOString(),
      };
      onCreated(newEvent);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-md"
      >
        <GlassCard padding="none">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white/80">Add Calendar Event</h3>
            <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              {([['strategy_call', 'Strategy Call', Phone], ['social_post', 'Social Post', ImageIcon]] as const).map(([type, label, Icon]) => (
                <button
                  key={type}
                  onClick={() => setEventType(type)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors',
                    eventType === type
                      ? type === 'strategy_call'
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                        : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                      : 'bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/60'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Common fields */}
            {[
              { label: 'Title *', value: title, setter: setTitle, placeholder: eventType === 'strategy_call' ? 'Monthly Strategy Call' : 'Instagram Reel — Product Launch' },
              { label: 'Notes', value: description, setter: setDescription, placeholder: 'Optional description…' },
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
                <label className="text-xs text-white/40">Date *</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-indigo-500/40 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">Time</label>
                <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-indigo-500/40 transition-all" />
              </div>
            </div>

            {/* Strategy Call fields */}
            {eventType === 'strategy_call' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-white/40">Duration (min)</label>
                    <input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} type="number" min="15" step="15"
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-indigo-500/40 transition-all" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Meeting URL</label>
                  <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..."
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm placeholder-white/20 outline-none focus:border-indigo-500/40 transition-all" />
                </div>
              </>
            )}

            {/* Social Post fields */}
            {eventType === 'social_post' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Platform</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all">
                    {(Object.entries(PLATFORM_LABELS) as [SocialPlatform, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Caption</label>
                  <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3}
                    placeholder="Post caption and hashtags…"
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm placeholder-white/20 outline-none focus:border-cyan-500/40 transition-all resize-none" />
                </div>
                {creatives.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-white/40">Creative Asset (optional)</label>
                    <select value={creativeId} onChange={(e) => setCreativeId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40 transition-all">
                      <option value="">— No creative linked —</option>
                      {creatives.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-white/[0.06]">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.09] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !title.trim() || !eventDate}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-colors disabled:opacity-40"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Event
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
