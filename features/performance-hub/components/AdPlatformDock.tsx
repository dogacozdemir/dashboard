'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { formatRelativeFromMessages } from '@/lib/i18n/format-relative-from-messages';
import { ChannelGlassIcon } from './ChannelGlassIcon';
import type { ConnectedAdAccount } from '../types';
import type { Platform } from '../types';

const ORDER: Platform[] = ['meta', 'google', 'tiktok'];

function oauthHref(platform: Platform) {
  return `/api/oauth/${platform}`;
}

export function AdPlatformDock({
  accounts,
  className,
}: {
  accounts: ConnectedAdAccount[];
  className?: string;
}) {
  const t    = useTranslations('Performance.connectedAccounts');
  const tRel = useTranslations('Shared.relativeTime');

  function syncedRelative(iso: string): string {
    return formatRelativeFromMessages(iso, (key, values) =>
      tRel(key as 'justNow' | 'minutes' | 'hours' | 'days', values),
    );
  }

  function accountFor(platform: Platform) {
    return accounts.find((a) => a.platform === platform);
  }

  return (
    <div className={cn('flex flex-wrap items-stretch justify-center gap-2 sm:gap-3', className)}>
      {ORDER.map((platform) => {
        const acc       = accountFor(platform);
        const connected = Boolean(acc);

        if (!connected) {
          return (
            <Link
              key={platform}
              href={oauthHref(platform)}
              prefetch={false}
              aria-label={t(`connectAria.${platform}`)}
              className={cn(
                'inline-flex items-center justify-center rounded-2xl border border-white/[0.12]',
                'bg-white/[0.04] px-2 py-2 sm:px-3 sm:py-2.5',
                'transition-colors hover:bg-white/[0.07] hover:border-white/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bea042]/45',
              )}
            >
              <ChannelGlassIcon platform={platform} className="w-10 h-10 sm:w-11 sm:h-11" />
            </Link>
          );
        }

        return (
          <div
            key={platform}
            className={cn(
              'flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04]',
              'pl-2 pr-1 py-1.5 sm:pl-3 sm:pr-1.5 min-h-[44px]',
            )}
          >
            <ChannelGlassIcon platform={platform} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
            <div className="min-w-0 flex-1 hidden sm:block pr-1">
              <p className="text-[10px] font-medium text-white/75 capitalize leading-tight">{platform}</p>
              <p className="text-[9px] text-white/35 truncate max-w-[140px] leading-tight">
                {acc!.accountName ?? t('accountFallback')}
                {acc!.lastSyncedAt && (
                  <span className="text-white/22">
                    {' · '}
                    {t('syncedPrefix')} {syncedRelative(acc!.lastSyncedAt)}
                  </span>
                )}
              </p>
            </div>
            <Link
              href={oauthHref(platform)}
              prefetch={false}
              aria-label={t(`reauthAria.${platform}`)}
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                'border border-white/[0.08] bg-white/[0.03] text-white/55',
                'hover:bg-white/[0.07] hover:text-white/85 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bea042]/45',
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
