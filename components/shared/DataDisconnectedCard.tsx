'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';

export interface DataDisconnectedCardProps {
  className?: string;
  title?: string;
  description?: string;
  reconnectHref?: string;
  reconnectLabel?: string;
  /** Extra OAuth / settings links shown as secondary actions */
  secondaryLinks?: Array<{ href: string; label: string }>;
  /** When set, replaces the default reconnect row + secondary links (e.g. icon OAuth dock). */
  actions?: ReactNode;
}

export function DataDisconnectedCard({
  className,
  title,
  description,
  reconnectHref = '/performance',
  reconnectLabel,
  secondaryLinks,
  actions,
}: DataDisconnectedCardProps) {
  const t = useTranslations('Shared.dataDisconnected');
  const displayTitle = title ?? t('defaultTitle');
  const displayDescription = description ?? t('defaultDescription');
  const displayReconnect = reconnectLabel ?? t('reconnectLabel');

  return (
    <GlassCard
      padding="lg"
      className={cn(
        'bento-card relative overflow-hidden border border-[#bea042]/25 shadow-[0_0_0_1px_rgba(190,160,66,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(190,160,66,0.9) 0%, transparent 65%)',
        }}
      />
      <div className="relative z-[2] flex flex-col items-center text-center gap-5 py-2 md:py-4 max-w-md mx-auto">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#bea042]/35 bg-[#bea042]/[0.08]">
          <motion.div
            className="absolute inset-0 rounded-2xl bg-[#bea042]/20"
            animate={{ opacity: [0.35, 0.85, 0.35], scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Radio className="relative z-[1] h-7 w-7 text-[#bea042]" strokeWidth={1.75} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-tight text-white/90">{displayTitle}</h3>
          <p className="text-xs text-white/40 leading-relaxed">{displayDescription}</p>
        </div>
        {actions != null ? (
          <div className="w-full flex justify-center">{actions}</div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-center">
            <Link
              href={reconnectHref}
              className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-xs font-semibold text-[#0c070c] bg-[#bea042] hover:bg-[#c9ae52] border border-[#bea042]/60 transition-colors shadow-[0_0_24px_rgba(190,160,66,0.25)]"
            >
              {displayReconnect}
            </Link>
            {secondaryLinks?.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-medium text-white/65 bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.07] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
