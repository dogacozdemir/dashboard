'use client';

import { motion } from 'framer-motion';
import { Activity, CheckCircle2, ClipboardList, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import type { AdminOverviewStats } from '../types/admin-overview';
import type { AdminOpsTaskItem, AdminRecentApprovalItem, AdminTaskType } from '../types/admin-tasks';
import { OpsImpersonateLink } from './OpsImpersonateLink';

const listParent = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
};

function taskBadgeMeta(
  type: AdminTaskType,
  t: (key: string) => string,
): { label: string; className: string } {
  switch (type) {
    case 'MISSING_BRAND_VAULT':
      return {
        label: t('taskMissingVault'),
        className:
          'border-[#bea042]/35 bg-[#bea042]/10 text-[#e8d48a] shadow-[0_0_20px_rgba(190,160,66,0.2)]',
      };
    case 'CREATIVE_APPROVAL_PENDING':
      return {
        label: t('taskPendingApproval'),
        className:
          'border-amber-400/35 bg-amber-500/12 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.18)]',
      };
    case 'CREATIVE_REVISION_REQUEST':
      return {
        label: t('taskRevision'),
        className:
          'border-violet-400/35 bg-violet-500/12 text-violet-200 shadow-[0_0_20px_rgba(167,139,250,0.2)]',
      };
    case 'CREATIVE_APPROVED':
      return {
        label: t('taskApproved'),
        className:
          'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.22)]',
      };
    default:
      return {
        label: t('taskOps'),
        className: 'border-white/15 bg-white/[0.06] text-white/65',
      };
  }
}

function priorityLabel(p: string, t: (key: string) => string) {
  switch (p) {
    case 'critical':
      return t('priorityCritical');
    case 'high':
      return t('priorityHigh');
    case 'medium':
      return t('priorityMedium');
    default:
      return t('priorityLow');
  }
}

type Props = {
  activeTasks: AdminOpsTaskItem[];
  recentApprovals: AdminRecentApprovalItem[];
  health: AdminOverviewStats;
};

export function AdminOpsCenterClient({ activeTasks, recentApprovals, health }: Props) {
  const t = useTranslations('Admin.opsCenter');
  const empty = activeTasks.length === 0;

  return (
    <div className="relative min-h-[calc(100vh-8rem)] pb-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="gpu-heavy-blur-layer absolute -left-[18%] top-0 h-[38rem] w-[38rem] rounded-full bg-gradient-to-br from-violet-600/30 to-transparent blur-3xl opacity-90" />
        <div className="gpu-heavy-blur-layer absolute -right-[12%] bottom-0 h-[32rem] w-[32rem] rounded-full bg-gradient-to-tl from-[#bea042]/15 to-transparent blur-3xl opacity-80" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-12">
        <header className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/35 font-medium">
            {t('eyebrow')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight gradient-text-indigo">
            {t('heroTitle')}
          </h1>
          <p className="text-sm text-white/45 max-w-2xl leading-relaxed">
            {t('heroSubtitle')}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active tasks */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-white/80">
              <ClipboardList className="size-5 text-[#bea042]" />
              <h2 className="text-lg font-semibold">{t('activeTasks')}</h2>
              <span className="text-xs text-white/35 ml-auto tabular-nums">{t('openTasksSuffix', { count: activeTasks.length })}</span>
            </div>

            {empty ? (
              <div
                className={cn(
                  'rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-3xl backdrop-saturate-200',
                  'p-10 md:p-14 text-center space-y-4 shadow-[0_12px_48px_-16px_rgba(0,0,0,0.55)]',
                )}
              >
                <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border border-emerald-400/25 bg-emerald-500/10">
                  <Sparkles className="size-8 text-emerald-300/90" />
                </div>
                <p className="text-lg font-medium text-white/90">{t('emptyStableTitle')}</p>
                <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                  {t('emptyStableSubtitle')}
                </p>
              </div>
            ) : (
              <motion.ul className="space-y-4" variants={listParent} initial="hidden" animate="show">
                {activeTasks.map((task) => {
                  const badge = taskBadgeMeta(task.taskType, t);
                  return (
                    <motion.li
                      key={task.id}
                      variants={listItem}
                      className={cn(
                        'rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-3xl backdrop-saturate-200',
                        'p-5 md:p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
                        'transition-all duration-300 hover:scale-[1.01] hover:border-white/20',
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md',
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-white/35">
                              {priorityLabel(task.priority, t)}
                            </span>
                            {task.source === 'computed' && (
                              <span className="text-[10px] text-cyan-300/50 uppercase tracking-wider">
                                {t('liveScan')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#bea042]/80 font-medium">{task.tenantName}</p>
                          <p className="text-base font-medium text-white/90 leading-snug">{task.title}</p>
                          {task.body ? (
                            <p className="text-sm text-white/45 leading-relaxed">{task.body}</p>
                          ) : null}
                        </div>
                        <OpsImpersonateLink tenantSlug={task.tenantSlug} path={task.targetPath} />
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </section>

          {/* Side column: recent + health */}
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-white/80">
                <CheckCircle2 className="size-5 text-emerald-400/90" />
                <h2 className="text-lg font-semibold">{t('recentApprovals')}</h2>
              </div>
              <div
                className={cn(
                  'rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-3xl backdrop-saturate-200',
                  'p-4 md:p-5 space-y-3 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
                )}
              >
                {recentApprovals.length === 0 ? (
                  <p className="text-sm text-white/35 py-4 text-center">{t('noApprovalsYet')}</p>
                ) : (
                  <ul className="space-y-3">
                    {recentApprovals.map((a) => (
                      <li
                        key={a.assetId}
                        className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
                      >
                        <span
                          className={cn(
                            'mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                            taskBadgeMeta('CREATIVE_APPROVED', t).className,
                          )}
                        >
                          {t('taskApproved')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white/75 truncate">{a.title}</p>
                          <p className="text-[10px] text-white/35 truncate">{a.tenantName}</p>
                        </div>
                        <OpsImpersonateLink
                          tenantSlug={a.tenantSlug}
                          path="/creative"
                          label={t('goCreative')}
                          iconOnly
                          className="shrink-0 inline-flex size-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] p-0 hover:border-[#bea042]/35"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-white/80">
                <Activity className="size-5 text-cyan-300/90" />
                <h2 className="text-lg font-semibold">{t('healthCheck')}</h2>
              </div>
              <div
                className={cn(
                  'rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-3xl backdrop-saturate-200',
                  'p-5 md:p-6 space-y-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
                )}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-white/45">{t('perfScore')}</span>
                  <span className="tabular-nums text-[#bea042] font-semibold">
                    %{health.healthScoreDisplay}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/45">{t('activeTenantsLabel')}</span>
                  <span className="text-white/80 tabular-nums">{health.activeTenants}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/45">{t('sync24h')}</span>
                  <span className="text-white/80 tabular-nums">{health.recentSyncs24h}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {(['meta', 'google', 'tiktok'] as const).map((p) => {
                    const h = health.platformHealth[p];
                    const dot =
                      h === 'ok' ? 'bg-emerald-400' : h === 'warn' ? 'bg-amber-400' : 'bg-rose-400';
                    const platformLabel =
                      p === 'meta' ? t('platformMeta') : p === 'google' ? t('platformGoogle') : t('platformTiktok');
                    return (
                      <div
                        key={p}
                        className="rounded-2xl border border-white/10 bg-black/25 px-2 py-3 text-center"
                      >
                        <div className={cn('mx-auto mb-1 size-2 rounded-full', dot)} />
                        <p className="text-[10px] uppercase tracking-wider text-white/40">{platformLabel}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
