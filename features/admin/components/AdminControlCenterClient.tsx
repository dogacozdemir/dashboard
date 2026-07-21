'use client';

import Link from 'next/link';
import { DEFAULT_CURRENCY } from '@/lib/utils/format';
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
import { GlassCard } from '@/components/shared/GlassCard';
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
        plate:
          'border-emerald-400/35 bg-emerald-500/[0.12] shadow-[0_0_24px_rgba(52,211,153,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]',
        dot: 'border border-emerald-300/40 bg-emerald-400',
        bloom: 'shadow-[0_0_10px_rgba(52,211,153,0.9),0_0_22px_rgba(52,211,153,0.45)]',
      };
    case 'warn':
      return {
        plate:
          'border-amber-400/35 bg-amber-500/[0.12] shadow-[0_0_22px_rgba(251,191,36,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]',
        dot: 'border border-amber-300/40 bg-amber-400',
        bloom: 'shadow-[0_0_10px_rgba(251,191,36,0.85),0_0_22px_rgba(251,191,36,0.4)]',
      };
    default:
      return {
        plate:
          'border-rose-400/35 bg-rose-500/[0.14] shadow-[0_0_24px_rgba(251,113,133,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]',
        dot: 'border border-rose-300/45 bg-rose-400',
        bloom: 'shadow-[0_0_10px_rgba(251,113,133,0.9),0_0_22px_rgba(251,113,133,0.45)]',
      };
  }
}

function PlatformHealthOrb({
  h,
  label,
  statusLabel,
}: {
  h: PlatformHealth;
  label: string;
  statusLabel: string;
}) {
  const s = healthStyles(h);
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={cn(
          'relative flex size-14 items-center justify-center rounded-2xl border backdrop-blur-xl',
          s.plate,
        )}
      >
        <span
          className={cn(
            'relative size-3.5 rounded-full animate-pulse',
            s.dot,
            s.bloom,
          )}
        />
      </div>
      <span className="text-xs font-medium text-white/55">{label}</span>
      <span className="text-[10px] uppercase tracking-wider text-white/30">{statusLabel}</span>
    </div>
  );
}

function formatSpend(n: number, localeTag: string) {
  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
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
    <div className="relative min-h-[calc(100vh-10rem)] pb-32">
      <div className="relative z-10 mx-auto max-w-6xl space-y-10 cockpit-liquid-scope">
        <header className="space-y-5">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/35"
          >
            {t('eyebrow')}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.05 }}
            className="text-4xl font-semibold tracking-tight text-balance leading-[1.05] sm:text-5xl md:text-6xl"
          >
            <span className="block gradient-text-indigo">{t('heroTitle')}</span>
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 260, damping: 28 }}
            className="flex flex-wrap items-center gap-3"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white/45 backdrop-blur-xl">
              <Sparkles className="gold-icon size-3" />
              {t('aiBadge')}
            </span>
            <p className="max-w-3xl text-sm font-medium leading-relaxed sm:text-base">
              <span className="font-normal text-white/50">{t('aiHealthPrefix')} </span>
              <span className="gradient-text-static">{summary}</span>
            </p>
          </motion.div>
        </header>

        <motion.div
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
          variants={listParent}
          initial="hidden"
          animate="show"
        >
          <GlassCard
            variants={listItem}
            hover
            padding="lg"
            className="bento-card group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-white/40">{t('tenantOverview')}</p>
                <p className="text-3xl font-semibold tabular-nums text-white/95">{stats.totalTenants}</p>
                <p className="text-sm text-white/45">
                  <span className="text-emerald-400/90">
                    {stats.activeTenants} {t('activeShort')}
                  </span>
                  {' · '}
                  <span className="text-white/35">
                    {stats.inactiveTenants} {t('inactiveShort')}
                  </span>
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                <Building2 className="size-6 text-violet-300/80" />
              </div>
            </div>
            <Link
              href="/tenants"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors group-hover:text-white"
            >
              {t('manageCustomers')}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </GlassCard>

          <GlassCard variants={listItem} hover padding="lg" className="bento-card group">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-white/40">{t('systemVolume')}</p>
                <p className="text-2xl font-semibold tabular-nums text-white/95 sm:text-3xl">
                  {formatSpend(stats.totalSpend30d, localeTag)}
                </p>
                <p className="text-sm text-white/45">
                  {t('spendSubtitle')}{' '}
                  <span className="text-white/60">
                    {t('managedAssets', { count: stats.totalManagedAssets.toLocaleString(localeTag) })}
                  </span>
                </p>
                <p className="text-xs text-white/30">
                  {t('campaignRows', {
                    count: stats.totalCampaignRows.toLocaleString(localeTag),
                  })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                <Layers className="size-6 text-amber-300/80" />
              </div>
            </div>
          </GlassCard>

          <GlassCard variants={listItem} hover padding="lg" className="bento-card">
            <p className="mb-5 text-xs uppercase tracking-widest text-white/40">{t('syncStatus')}</p>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ['meta', stats.platformHealth.meta, t('platformMeta')] as const,
                  ['google', stats.platformHealth.google, t('platformGoogle')] as const,
                  ['tiktok', stats.platformHealth.tiktok, t('platformTiktok')] as const,
                ] as const
              ).map(([key, h, label]) => (
                <PlatformHealthOrb
                  key={key}
                  h={h}
                  label={label}
                  statusLabel={
                    h === 'ok' ? t('healthOk') : h === 'warn' ? t('healthWarn') : t('healthBad')
                  }
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard variants={listItem} hover padding="lg" className="bento-card group">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-white/40">{t('roleCardTitle')}</p>
                <p className="text-lg font-medium leading-snug text-white/90">{t('roleCardLead')}</p>
                <p className="text-sm text-white/40">{t('roleCardSub')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                <Shield className="size-6 text-cyan-300/80" />
              </div>
            </div>
            <Link
              href="/roles"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-violet-300/90 transition-colors hover:text-violet-200"
            >
              {t('openRoleBuilder')}
              <ArrowRight className="size-4" />
            </Link>
          </GlassCard>
        </motion.div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <motion.nav
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.35 }}
          className={cn(
            'pointer-events-auto relative flex flex-wrap items-center justify-center gap-2 sm:gap-3',
            'glass glow-inset rounded-[2rem] border border-white/10 px-3 py-3',
            'shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)]',
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
        'text-xs font-medium text-white/65 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.06] hover:text-white sm:text-sm',
      )}
    >
      <Icon className="size-4 shrink-0 gold-icon opacity-90" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
