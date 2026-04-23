import { CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AssetStatus } from '../types';

interface ApprovalBadgeProps {
  status: AssetStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<AssetStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}> = {
  approved: { label: 'Approved',       icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending:  { label: 'Pending Review', icon: Clock,        className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  revision: { label: 'Needs Revision', icon: RotateCcw,   className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export function ApprovalBadge({ status, size = 'sm' }: ApprovalBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
      config.className
    )}>
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {config.label}
    </span>
  );
}
