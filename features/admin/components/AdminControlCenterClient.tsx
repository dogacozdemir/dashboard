'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  Building2,
  Layers,
  Plus,
  ScrollText,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import type { AdminOverviewStats, PlatformHealth } from '../types/admin-overview';

const listParent = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 26, mass: 0.9 },
  },
};

function healthStyles(h: PlatformHealth) {
  switch (h) {
    case 'ok':
      return {
        ring: 'shadow-[0_0_20px_rgba(52,211,153,0.35)]',
        bg:   'bg-emerald-400/25 border-emerald-400/40',
        dot:  'bg-emerald-400',
      };
    case 'warn':
      return {
        ring: 'shadow-[0_0_18px_rgba(251,191,36,0.35)]',
        bg:   'bg-amber-400/20 border-amber-400/35',
        dot:  'bg-amber-400',
      };
    default:
      return {
        ring: 'shadow-[0_0_20px_rgba(251,113,133,0.35)]',
        bg:   'bg-rose-500/20 border-rose-400/40',
        dot:  'bg-rose-400',
      };
  }
}

function formatSpend(n: number, localeTag: string) {
  return new Intl.NumberFormat(localeTag, {
    style:    'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

type Props = { stats: AdminOverviewStats };

export function AdminControlCenterClient({ stats }: Props) {
  const t = useTranslations('Admin.controlCenter');
  const locale = useLocale();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-US';
  const perfStr = Number.isInteger(stats.healthScoreDisplay)
    ? stats.healthScoreDisplay.toString()
    : stats.healthScoreDisplay.toFixed(1);
  const summary = t('summary', {
    activeTenants: stats.activeTenants,
    recentSyncs24h: stats.recentSyncs24h,
    perfPercent: `${perfStr}%`,
  });

  return (
    <div className="relative min-h-[calc(100vh-8rem)] pb-32">
      {/* Aurora / GPU-style blur layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          className="gpu-heavy-blur-layer absolute -left-[20%] top-0 h-[min(42rem,80vh)] w-[min(42rem,80vw)] rounded-full bg-gradient-to-br from-violet-600/[0.45] via-fuchsia-500/20 to-transparent blur-3xl"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 140, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="gpu-heavy-blur-layer absolute -right-[15%] bottom-[10%] h-[min(36rem,70vh)] w-[min(36rem,70vw)] rounded-full bg-gradient-to-tl from-amber-500/[0.28] via-violet-700/25 to-transparent blur-3xl"
          animate={{ rotate: [360, 0] }}
          transition={{ duration: 110, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,200,0.12),transparent)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-10">
        {/* Hero */}
        <header className="space-y-5">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="text-[11px] uppercase tracking-[0.35em] text-white/35 font-medium"
          >
            {t('eyebrow')}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.05 }}
            className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]"
          >
            <span className="block gradient-text-indigo">
              {t('heroTitle')}
            </span>
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 260, damping: 28 }}
            className="flex flex-wrap items-center gap-3"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white/45 backdrop-blur-xl">
              <Sparkles className="size-3 text-[#bea042]" />
              {t('aiBadge')}
            </span>
            <p
              className="text-sm sm:text-base text-[#bea042] font-medium max-w-3xl leading-relaxed"
              style={{
                textShadow:
                  '0 0 20px rgba(190,160,66,0.55), 0 0 40px rgba(190,160,66,0.25), 0 0 2px rgba(190,160,66,0.9)',
              }}
            >
              <span className="text-white/50 font-normal">{t('aiHealthPrefix')} </span>
              {summary}
            </p>
          </motion.div>
        </header>

        {/* Bento */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          variants={listParent}
          initial="hidden"
          animate="show"
        >
          {/* Tenant overview */}
          <motion.div
            variants={listItem}
            className={cn(
              'group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-3xl',
              'p-6 md:p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
              'transition-all duration-300 hover:scale-[1.02] hover:border-white/20',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-white/40">{t('tenantOverview')}</p>
                <p className="text-3xl font-semibold tabular-nums text-white/95">{stats.totalTenants}</p>
                <p className="text-sm text-white/45">
                  <span className="text-emerald-400/90">{stats.activeTenants} {t('activeShort')}</span>
                  {' · '}
                  <span className="text-white/35">{stats.inactiveTenants} {t('inactiveShort')}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                <Building2 className="size-6 text-violet-300/80" />
              </div>
            </div>
            <Link
              href="/tenants"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors group/link"
            >
              {t('manageCustomers')}
              <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-0.5" />
            </Link>
          </motion.div>

          {/* Revenue / volume */}
          <motion.div
            variants={listItem}
            className={cn(
              'group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-3xl',
              'p-6 md:p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
              'transition-all duration-300 hover:scale-[1.02] hover:border-white/20',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-white/40">{t('systemVolume')}</p>
                <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-white/95">
                  {formatSpend(stats.totalSpend30d, localeTag)}
                </p>
                <p className="text-sm text-white/45">
                  {t('spendSubtitle')}{' '}
                  <span className="text-white/60">{t('managedAssets', { count: stats.totalManagedAssets.toLocaleString(localeTag) })}</span>
                </p>
                <p className="text-xs text-white/30">
                  {t('campaignRows', { count: stats.totalCampaignRows.toLocaleString(localeTag) })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                <Layers className="size-6 text-amber-300/80" />
              </div>
            </div>
          </motion.div>

          {/* Sync status */}
          <motion.div
            variants={listItem}
            className={cn(
              'relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-3xl',
              'p-6 md:p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
              'transition-all duration-300 hover:scale-[1.02] hover:border-white/20',
            )}
          >
            <p className="text-xs uppercase tracking-widest text-white/40 mb-5">{t('syncStatus')}</p>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ['meta', stats.platformHealth.meta, t('platformMeta')] as const,
                  ['google', stats.platformHealth.google, t('platformGoogle')] as const,
                  ['tiktok', stats.platformHealth.tiktok, t('platformTiktok')] as const,
                ] as const
              ).map(([key, h, label]) => {
                const s = healthStyles(h);
                return (
                  <div key={key} className="flex flex-col items-center gap-2 text-center">
                    <div
                      className={cn(
                        'flex size-14 items-center justify-center rounded-2xl border backdrop-blur-xl',
                        s.bg,
                        s.ring,
                      )}
                    >
                      <span className={cn('size-3 rounded-full', s.dot)} />
                    </div>
                    <span className="text-xs font-medium text-white/55">{label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-white/30">
                      {h === 'ok' ? t('healthOk') : h === 'warn' ? t('healthWarn') : t('healthBad')}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Role architect */}
          <motion.div
            variants={listItem}
            className={cn(
              'relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-3xl',
              'p-6 md:p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
              'transition-all duration-300 hover:scale-[1.02] hover:border-white/20',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-white/40">{t('roleCardTitle')}</p>
                <p className="text-lg font-medium text-white/90 leading-snug">
                  {t('roleCardLead')}
                </p>
                <p className="text-sm text-white/40">{t('roleCardSub')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                <Shield className="size-6 text-cyan-300/80" />
              </div>
            </div>
            <Link
              href="/roles"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-violet-300/90 hover:text-violet-200 transition-colors"
            >
              {t('openRoleBuilder')}
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Quick actions dock */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <motion.nav
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.35 }}
          className={cn(
            'pointer-events-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3',
            'rounded-[2rem] border border-white/10 bg-[#0a0a12]/75 px-3 py-3 backdrop-blur-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)]',
          )}
          aria-label={t('dockAria')}
        >
          <DockLink href="/tenants" icon={Plus} label={t('dockNewTenant')} />
          <DockLink href="/tenants" icon={Bell} label={t('dockGlobalNotif')} />
          <DockLink href="/uploads" icon={ScrollText} label={t('dockLogs')} />
          <DockLink href="/roles" icon={Shield} label={t('dockRoleBuilder')} />
        </motion.nav>
      </div>
    </div>
  );
}

function DockLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-transparent px-3 py-2.5 sm:px-4',
        'text-xs sm:text-sm font-medium text-white/65 hover:text-white',
        'hover:bg-white/[0.06] hover:border-white/10 transition-all duration-200',
      )}
    >
      <Icon className="size-4 shrink-0 text-[#bea042]/90" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
