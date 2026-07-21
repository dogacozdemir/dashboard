'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ExternalLink,
  Users,
  BarChart3,
  Image as ImageIcon,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelativeFromMessages } from '@/lib/i18n/format-relative-from-messages';
import { cn } from '@/lib/utils/cn';
import { navigateToTenantAsCustomer } from '@/lib/auth/impersonate-navigate';
import { useTranslations } from 'next-intl';
import { toggleTenantStatus, updateTenantCurrency } from '../actions/fetchAdmin';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';
import { DEFAULT_CURRENCY, currencySymbol } from '@/lib/utils/format';
import { CreateTenantButton, CreateTenantDialog } from './CreateTenantDialog';
import type { TenantWithStats } from '../types';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

const planColors: Record<string, string> = {
  starter: 'bg-white/5 text-white/40 border-white/10',
  growth: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  enterprise: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

/**
 * Reporting currency per tenant — every money surface (dashboard, reports, PDFs,
 * e-mails) formats against it, so the agency sets it here.
 */
function CurrencyPicker({ tenantId, value }: { tenantId: string; value: string }) {
  const [current, setCurrent] = useState(value);
  const [saving, startSaving] = useTransition();

  return (
    <select
      value={current}
      disabled={saving}
      aria-label="Currency"
      onChange={(e) => {
        const next = e.target.value;
        const previous = current;
        setCurrent(next);
        startSaving(async () => {
          const res = await updateTenantCurrency(tenantId, next);
          if (!res.success) setCurrent(previous);
        });
      }}
      className="cursor-pointer rounded-lg border border-white/[0.10] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-white/60 outline-none transition-colors hover:bg-white/[0.06] focus:border-[#9c70b2]/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c} value={c} className="bg-[#161018] text-white/80">
          {currencySymbol(c)} {c}
        </option>
      ))}
    </select>
  );
}

export type PlanSegment = 'all' | 'enterprise' | 'growth';

function PlanSegmentedControl({
  value,
  onChange,
}: {
  value: PlanSegment;
  onChange: (v: PlanSegment) => void;
}) {
  const t = useTranslations('Admin.tenantTable');
  const order = ['all', 'enterprise', 'growth'] as const;
  const idx = order.indexOf(value);

  const labels: Record<PlanSegment, string> = {
    all: t('segmentAll'),
    enterprise: t('segmentEnterprise'),
    growth: t('segmentGrowth'),
  };

  return (
    <div
      role="tablist"
      aria-label={`${labels.all} · ${labels.enterprise} · ${labels.growth}`}
      className="relative flex h-10 w-full min-w-[16.5rem] rounded-xl border border-white/10 bg-white/[0.04] p-1 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:min-w-[18.5rem] sm:max-w-xl"
    >
      <motion.div
        className="pointer-events-none absolute top-1 bottom-1 z-0 rounded-lg border border-white/10 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
        initial={false}
        style={{ width: 'calc((100% - 8px) / 3)' }}
        animate={{
          left: idx === 0 ? 4 : idx === 1 ? 'calc(33.333333% + 2px)' : 'calc(66.666666% + 0px)',
        }}
        transition={{ type: 'spring', stiffness: 440, damping: 34 }}
      />
      {order.map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            'relative z-10 flex-1 rounded-lg px-1.5 text-[11px] font-semibold tracking-wide transition-colors sm:px-2',
            value === key ? 'text-white/90' : 'text-white/35 hover:text-white/55',
          )}
        >
          {labels[key]}
        </button>
      ))}
    </div>
  );
}

interface TenantTableProps {
  tenants: TenantWithStats[];
}

function ImpersonateButton({ slug, label }: { slug: string; label: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await navigateToTenantAsCustomer(slug, '/dashboard');
    });
  }

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      disabled={pending}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-[11px] font-semibold text-[#1a0f00] disabled:opacity-50"
      style={{
        background: 'linear-gradient(135deg, #e8d48a 0%, #bea042 55%, #a07b28 100%)',
        boxShadow: '0 0 20px rgba(190,160,66,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
        border: '1px solid rgba(139,110,30,0.45)',
      }}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
      {label}
    </motion.button>
  );
}

export function TenantTable({ tenants }: TenantTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanSegment>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [rows, setRows] = useState(tenants);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useTranslations('Admin.tenantTable');
  const tRel = useTranslations('Shared.relativeTime');

  useEffect(() => {
    setRows(tenants);
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (planFilter === 'enterprise') return row.plan === 'enterprise';
      if (planFilter === 'growth') return row.plan === 'growth';
      return true;
    });
  }, [rows, search, planFilter]);

  function onToggleStatus(tenant: TenantWithStats) {
    const nextActive = !tenant.is_active;
    setActionError(null);
    setTogglingId(tenant.id);
    setRows((prev) =>
      prev.map((row) => (row.id === tenant.id ? { ...row, is_active: nextActive } : row)),
    );

    startTransition(async () => {
      const res = await toggleTenantStatus(tenant.id, nextActive);
      setTogglingId(null);
      if (!res.success) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === tenant.id ? { ...row, is_active: tenant.is_active } : row,
          ),
        );
        setActionError(t('toggleError'));
        return;
      }
      router.refresh();
    });
  }

  const headers = [
    t('colBrand'),
    t('colSubdomain'),
    t('colPlan'),
    t('colUsers'),
    t('colCampaigns'),
    t('colAssets'),
    t('colStatus'),
    t('colLastActivity'),
    '',
  ];

  return (
    <>
      <CreateTenantDialog open={createOpen} onOpenChange={setCreateOpen} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="glass glow-inset gpu-glass-promote relative overflow-hidden rounded-[2rem]"
      >
        <div className="flex flex-col gap-4 border-b border-white/[0.06] px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-white/88">{t('heading')}</h3>
              <p className="mt-1 text-xs text-white/32">{t('subheading', { count: filtered.length })}</p>
            </div>
            <CreateTenantButton onClick={() => setCreateOpen(true)} />
          </div>

          {actionError && (
            <p role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200/90">
              {actionError}
            </p>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <PlanSegmentedControl value={planFilter} onChange={setPlanFilter} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-xs text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-all placeholder:text-white/25 focus:border-white/15 lg:ml-auto lg:max-w-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-white/55">{t('emptyTitle')}</p>
              <p className="mt-1 text-xs text-white/30">{t('emptySubtitle')}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {headers.map((h, idx) => (
                    <th
                      key={`${h}-${idx}`}
                      className="whitespace-nowrap px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/28"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tenant, i) => {
                  const isToggling = togglingId === tenant.id;
                  return (
                    <motion.tr
                      key={tenant.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ ...spring, delay: Math.min(i * 0.035, 0.35) }}
                      className={cn(
                        'border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] group',
                        isToggling && 'opacity-70',
                      )}
                    >
                      <td className="px-6 py-4 align-middle">
                        <div>
                          <p className="text-sm font-medium text-white/85">{tenant.name}</p>
                          <p className="font-mono text-[11px] text-white/28">{tenant.slug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        {tenant.custom_domain ? (
                          <a
                            href={`https://${tenant.custom_domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-400/90 transition-colors hover:text-indigo-300"
                          >
                            {tenant.custom_domain}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-white/40">{tenant.slug}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize',
                              planColors[tenant.plan],
                            )}
                          >
                            {tenant.plan}
                          </span>
                          <CurrencyPicker
                            tenantId={tenant.id}
                            value={tenant.currency ?? DEFAULT_CURRENCY}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <Link
                          href={`/users?tenantId=${tenant.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm tabular-nums text-white/55 transition-colors hover:bg-white/[0.06] hover:text-indigo-300/90"
                          title={t('viewUsers')}
                        >
                          <Users className="h-3.5 w-3.5 text-white/22" />
                          {tenant.userCount}
                        </Link>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-1.5 text-sm tabular-nums text-white/55">
                          <BarChart3 className="h-3.5 w-3.5 text-white/22" />
                          {tenant.campaignCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-1.5 text-sm tabular-nums text-white/55">
                          <ImageIcon className="h-3.5 w-3.5 text-white/22" />
                          {tenant.assetCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        {isToggling ? (
                          <div className="flex items-center gap-1.5 text-xs text-white/45">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {t('statusUpdating')}
                          </div>
                        ) : tenant.is_active ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400/90">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('statusActive')}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-white/35">
                            <XCircle className="h-3.5 w-3.5" />
                            {t('statusInactive')}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 align-middle text-xs text-white/28">
                        {tenant.lastActivity
                          ? formatRelativeFromMessages(tenant.lastActivity, tRel)
                          : '—'}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <ImpersonateButton slug={tenant.slug} label={t('impersonate')} />
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              disabled={isToggling}
                              className="cursor-pointer rounded-xl p-1 text-white/25 outline-none transition-colors hover:bg-white/[0.05] hover:text-white/55 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-2xl border-white/[0.10] bg-[#161018]/95 text-xs text-white/80 backdrop-blur-xl"
                            >
                              <DropdownMenuItem
                                onClick={() => router.push(`/users?tenantId=${tenant.id}&invite=1`)}
                                className="cursor-pointer rounded-xl"
                              >
                                {t('menuAddUser')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled
                                className="cursor-not-allowed rounded-xl text-white/30"
                              >
                                {t('menuEdit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={isToggling}
                                onSelect={() => onToggleStatus(tenant)}
                                className={cn(
                                  'cursor-pointer rounded-xl',
                                  tenant.is_active
                                    ? 'text-amber-400/90 hover:bg-amber-500/10'
                                    : 'text-emerald-400/90 hover:bg-emerald-500/10',
                                )}
                              >
                                {isToggling ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {t('statusUpdating')}
                                  </span>
                                ) : tenant.is_active ? (
                                  t('menuDeactivate')
                                ) : (
                                  t('menuActivate')
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </>
  );
}
