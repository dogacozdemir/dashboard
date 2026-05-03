'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils/cn';
import type { Platform } from '../types';

interface ChannelGlassIconProps {
  platform: Platform;
  className?: string;
}

/** Subtle glass-framed channel mark — Meta blue, Google multi, TikTok monochrome. */
export function ChannelGlassIcon({ platform, className }: ChannelGlassIconProps) {
  const gid = useId().replace(/:/g, '');

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-2xl',
        'border border-white/10 bg-white/[0.04] backdrop-blur-md',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_1px_0_0_rgba(255,255,255,0.06)]',
        className,
      )}
      aria-hidden
    >
      {platform === 'meta' && (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden>
          <path
            d="M12 2C6.48 2 2 6.02 2 11.26c0 4.13 2.55 7.66 6.2 9.18V14.7H7.48v-3.2H8.2V9.9c0-1.62.97-2.52 2.45-2.52.7 0 1.43.12 1.43.12v1.97h-.81c-.8 0-1.05.5-1.05 1.01v1.82h1.79l-.29 3.2h-1.5v5.74c3.65-1.52 6.2-5.05 6.2-9.18C22 6.02 17.52 2 12 2z"
            fill={`url(#metaGrad-${gid})`}
          />
          <defs>
            <linearGradient id={`metaGrad-${gid}`} x1="4" y1="4" x2="20" y2="20">
              <stop stopColor="#1877F2" />
              <stop offset="1" stopColor="#42A5FF" />
            </linearGradient>
          </defs>
        </svg>
      )}
      {platform === 'google' && (
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.25 1.6-1.9 4.7-5.5 4.7-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 4.7 14.7 3.5 12 3.5 6.9 3.5 2.5 7.9 2.5 12S6.9 20.5 12 20.5 21.5 16.6 21.5 12c0-.35-.05-.7-.1-1H12z" />
          <path fill="#34A853" d="M3.3 7.1l3.1 2.3C7.3 7.3 9.4 5.5 12 5.5c1.5 0 2.9.6 3.9 1.5l2.7-2.6C16.9 4.7 14.7 3.5 12 3.5 8 3.5 4.5 6.4 3.3 7.1z" />
          <path fill="#FBBC05" d="M12 20.5c2.6 0 4.8-.85 6.4-2.3l-3-2.5c-.85.55-1.95.9-3.4.9-2.9 0-5.35-1.95-6.2-4.6l-3.1 2.4C4.5 18.1 8 20.5 12 20.5z" />
          <path fill="#4285F4" d="M21.5 12.2c0-.75-.1-1.45-.25-2.1H12v4h5.4c-.25 1.3-1 2.4-2.1 3.1l3 2.5c1.75-1.6 2.75-4 2.75-6.5z" />
        </svg>
      )}
      {platform === 'tiktok' && (
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64v-3.4a6.34 6.34 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.14-5.1V9.66a8.16 8.16 0 0 0 4.77 1.52v-3.5a4.85 4.85 0 0 1-.32-.09z" />
        </svg>
      )}
    </span>
  );
}
