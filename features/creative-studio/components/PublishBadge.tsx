'use client';

import { Send, Loader2, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import type { PublishState } from '../types';

interface PublishBadgeProps {
  state: PublishState;
  /** Approved posts with a future slot read as "scheduled" rather than idle. */
  scheduled?: boolean;
  size?: 'sm' | 'md';
}

type BadgeKey = 'scheduled' | 'queued' | 'publishing' | 'published' | 'failed';

const badgeStyle: Record<BadgeKey, {
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  text: string;
  border: string;
}> = {
  scheduled: {
    labelKey: 'publishScheduled',
    icon: CalendarClock,
    bg: 'rgba(190,160,66,0.08)',
    text: 'text-[#bea042]',
    border: 'rgba(190,160,66,0.25)',
  },
  queued: {
    labelKey: 'publishQueued',
    icon: CalendarClock,
    bg: 'rgba(190,160,66,0.10)',
    text: 'text-[#bea042]',
    border: 'rgba(190,160,66,0.3)',
  },
  publishing: {
    labelKey: 'publishInProgress',
    icon: Loader2,
    bg: 'rgba(156,112,178,0.10)',
    text: 'text-[#b48dc8]',
    border: 'rgba(156,112,178,0.28)',
  },
  published: {
    labelKey: 'publishLive',
    icon: CheckCircle2,
    bg: 'rgba(16,185,129,0.08)',
    text: 'text-emerald-400',
    border: 'rgba(16,185,129,0.25)',
  },
  failed: {
    labelKey: 'publishFailed',
    icon: AlertTriangle,
    bg: 'rgba(244,63,94,0.08)',
    text: 'text-rose-400',
    border: 'rgba(244,63,94,0.25)',
  },
};

/** Nothing to show for a post that was never queued for publishing. */
export function publishBadgeKey(state: PublishState, scheduled: boolean): BadgeKey | null {
  if (state === 'published') return 'published';
  if (state === 'failed') return 'failed';
  if (state === 'publishing') return 'publishing';
  if (state === 'queued') return 'queued';
  return scheduled ? 'scheduled' : null;
}

export function PublishBadge({ state, scheduled = false, size = 'sm' }: PublishBadgeProps) {
  const t = useTranslations('Features.Creative');
  const key = publishBadgeKey(state, scheduled);
  if (!key) return null;

  const config = badgeStyle[key];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium max-w-full',
        config.text,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      )}
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Icon
        className={cn(
          size === 'sm' ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0',
          key === 'publishing' && 'animate-spin',
        )}
      />
      <span className="truncate">{t(config.labelKey)}</span>
    </span>
  );
}

export { Send as PublishIcon };
