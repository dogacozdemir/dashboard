'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Brain, Sparkles, Orbit, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TenantLogoMark } from '@/components/branding/TenantLogoMark';
import type { MonoWelcomeCopy } from '@/features/onboarding/actions/welcomeCopy';

const STORAGE_PREFIX = 'madmonos.firstFlight.dismissed.';

interface Props {
  companyId: string;
  copy: MonoWelcomeCopy;
  tenantName: string;
  brandLogoUrl?: string | null;
}

export function MonoAiWelcomeBanner({ companyId, copy, tenantName, brandLogoUrl }: Props) {
  const t = useTranslations('Features.DashboardPage.firstFlight');
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${companyId}`, [companyId]);

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="relative mb-6 w-full overflow-hidden rounded-[2rem] border border-white/10 px-4 py-4 md:px-6 md:py-5"
      style={{
        background: 'rgba(22, 11, 22, 0.72)',
        boxShadow:
          '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 16px 48px rgba(0,0,0,0.35), 0 0 60px rgba(156,112,178,0.08)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#bea042]/35 to-transparent" />

      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismissAria')}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/45 transition hover:bg-white/[0.1] hover:text-white/80"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col gap-4 pr-10 md:flex-row md:items-start md:gap-6">
        <div className="flex shrink-0 items-start gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(156,112,178,0.35), rgba(190,160,66,0.22))',
              border: '1px solid rgba(190,160,66,0.35)',
            }}
          >
            {brandLogoUrl?.trim() ? (
              <TenantLogoMark
                brandLogoUrl={brandLogoUrl}
                alt={tenantName}
                width={32}
                height={32}
                className="h-8 w-8"
              />
            ) : (
              <Brain className="h-6 w-6 text-white/90" />
            )}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              <Sparkles className="h-3 w-3 shrink-0 text-[#bea042]" />
              {t('badge')}
            </p>
            <h2 className="mt-1 text-base font-semibold leading-snug tracking-tight text-white/90 md:text-lg">
              {copy.headline}
            </h2>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3 md:pt-1">
          <p className="text-sm leading-relaxed text-white/60">{copy.subline}</p>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#bea042]/85">{t('sectorLabel')}</p>
            <p className="text-sm text-white/75">{copy.sector}</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {tenantName} · {t('brandMono')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/48">
            <span className="inline-flex items-center gap-1">
              <Orbit className="h-3 w-3 shrink-0 text-cyan-400/80" />
              {t('syncHint')}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/performance"
              className="rounded-xl border border-[#9c70b2]/35 bg-[#9c70b2]/12 px-4 py-2 text-xs font-semibold text-white/85 transition hover:border-[#bea042]/40 hover:bg-white/[0.06]"
            >
              {t('integrationsCta')}
            </Link>
            <Link
              href="/mono-ai"
              className="rounded-xl border border-[#bea042]/45 px-4 py-2 text-xs font-semibold text-[#1a0f00] transition hover:opacity-95"
              style={{
                background: 'linear-gradient(135deg, #e8d48a, #bea042)',
                boxShadow: '0 0 16px rgba(190,160,66,0.2)',
              }}
            >
              {t('monoAiCta')}
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
