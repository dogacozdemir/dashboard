'use client';

import { CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import type { AssetStatus } from '../types';

interface ApprovalBadgeProps {
  status: AssetStatus;
  size?: 'sm' | 'md';
}

const statusStyle: Record<AssetStatus, {
  labelKey: 'statusApproved' | 'statusPending' | 'statusRevision';
  icon:     React.ComponentType<{ className?: string }>;
  bg:       string;
  text:     string;
  border:   string;
  glow:     string;
}> = {
  approved: {
    labelKey: 'statusApproved',
    icon:     CheckCircle2,
    bg:       'rgba(16,185,129,0.08)',
    text:     'text-emerald-400',
    border:   'rgba(16,185,129,0.25)',
    glow:     '0 0 10px rgba(16,185,129,0.25)',
  },
  pending: {
    labelKey: 'statusPending',
    icon:     Clock,
    bg:       'rgba(156,112,178,0.1)',
    text:     'text-[#b48dc8]',
    border:   'rgba(156,112,178,0.28)',
    glow:     '0 0 10px rgba(156,112,178,0.25)',
  },
  revision: {
    labelKey: 'statusRevision',
    icon:     RotateCcw,
    bg:       'rgba(244,63,94,0.08)',
    text:     'text-rose-400',
    border:   'rgba(244,63,94,0.25)',
    glow:     '0 0 10px rgba(244,63,94,0.2)',
  },
};

export function ApprovalBadge({ status, size = 'sm' }: ApprovalBadgeProps) {
  const t = useTranslations('Features.Creative');
  const config = statusStyle[status];
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
        boxShadow: config.glow,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
      <span className="truncate">{t(config.labelKey)}</span>
    </span>
  );
}
