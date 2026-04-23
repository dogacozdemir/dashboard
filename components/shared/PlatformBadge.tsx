import { cn } from '@/lib/utils/cn';

type Platform = 'meta' | 'google' | 'tiktok' | 'geo' | 'ai';

interface PlatformBadgeProps {
  platform: Platform;
  size?: 'sm' | 'md';
  className?: string;
}

const configs: Record<Platform, { label: string; color: string; bg: string }> = {
  meta:   { label: 'Meta',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  google: { label: 'Google', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  tiktok: { label: 'TikTok', color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20' },
  geo:    { label: 'GEO',    color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
  ai:     { label: 'AI',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
};

export function PlatformBadge({ platform, size = 'sm', className }: PlatformBadgeProps) {
  const config = configs[platform];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium tracking-wide',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        config.bg,
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
