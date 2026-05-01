'use client';

import { useState, useTransition } from 'react';
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
import { getTenantDashboardUrl } from '@/lib/utils/tenant-urls';
import { useTranslations } from 'next-intl';
import type { TenantWithStats } from '../types';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

const planColors: Record<string, string> = {
  starter:    'bg-white/5 text-white/40 border-white/10',
  growth:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  enterprise: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

interface TenantTableProps {
  tenants: TenantWithStats[];
}

function ImpersonateButton({ slug, label }: { slug: string; label: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/impersonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        });
        if (!res.ok) return;
        window.location.href = getTenantDashboardUrl(slug, '/dashboard');
      } catch {
        /* noop */
      }
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
  const [search, setSearch] = useState('');
  const t = useTranslations('Admin.tenantTable');
  const tRel = useTranslations('Shared.relativeTime');

  const filtered = tenants.filter(
    (row) =>
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.slug.toLowerCase().includes(search.toLowerCase())
  );

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="relative rounded-[2rem] overflow-hidden"
      style={{
        background: 'rgba(29, 15, 29, 0.38)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow:
          '0 0 0 0.5px rgba(255,255,255,0.05) inset, 0 24px 80px rgba(0,0,0,0.45), 0 0 100px rgba(156,112,178,0.06)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none rounded-t-[2rem]" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-5 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-semibold text-white/88 tracking-tight">{t('heading')}</h3>
          <p className="text-xs text-white/32 mt-1">{t('subheading', { count: tenants.length })}</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full sm:w-56 px-4 py-2.5 rounded-2xl text-xs text-white/85 placeholder-white/25 outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {headers.map((h, idx) => (
                <th
                  key={`${h}-${idx}`}
                  className="px-6 py-3.5 text-left text-[10px] font-semibold text-white/28 uppercase tracking-[0.12em] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((tenant, i) => (
              <motion.tr
                key={tenant.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...spring, delay: Math.min(i * 0.035, 0.35) }}
                className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group"
              >
                <td className="px-6 py-4 align-middle">
                  <div>
                    <p className="text-sm font-medium text-white/85">{tenant.name}</p>
                    <p className="text-[11px] text-white/28 font-mono">{tenant.slug}</p>
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  {tenant.custom_domain ? (
                    <a
                      href={`https://${tenant.custom_domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-400/90 hover:text-indigo-300 transition-colors"
                    >
                      {tenant.custom_domain}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  ) : (
                    <span className="text-xs text-white/40 font-mono">{tenant.slug}</span>
                  )}
                </td>
                <td className="px-6 py-4 align-middle">
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium border capitalize',
                      planColors[tenant.plan]
                    )}
                  >
                    {tenant.plan}
                  </span>
                </td>
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center gap-1.5 text-sm text-white/55 tabular-nums">
                    <Users className="w-3.5 h-3.5 text-white/22" />
                    {tenant.userCount}
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center gap-1.5 text-sm text-white/55 tabular-nums">
                    <BarChart3 className="w-3.5 h-3.5 text-white/22" />
                    {tenant.campaignCount}
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center gap-1.5 text-sm text-white/55 tabular-nums">
                    <ImageIcon className="w-3.5 h-3.5 text-white/22" />
                    {tenant.assetCount}
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  {tenant.is_active ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400/90">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('statusActive')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-white/35">
                      <XCircle className="w-3.5 h-3.5" />
                      {t('statusInactive')}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 align-middle text-xs text-white/28 whitespace-nowrap">
                  {tenant.lastActivity ? formatRelativeFromMessages(tenant.lastActivity, tRel) : '—'}
                </td>
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center justify-end gap-2">
                    <ImpersonateButton slug={tenant.slug} label={t('impersonate')} />
                    <DropdownMenu>
                      <DropdownMenuTrigger className="text-white/25 hover:text-white/55 transition-colors outline-none cursor-pointer p-1 rounded-xl hover:bg-white/[0.05]">
                        <MoreVertical className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[#161018]/95 border-white/[0.10] text-white/80 text-xs rounded-2xl backdrop-blur-xl"
                      >
                        <DropdownMenuItem className="hover:bg-white/[0.06] cursor-pointer rounded-xl">
                          {t('menuEdit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={cn(
                            'cursor-pointer rounded-xl',
                            tenant.is_active
                              ? 'text-amber-400/90 hover:bg-amber-500/10'
                              : 'text-emerald-400/90 hover:bg-emerald-500/10'
                          )}
                        >
                          {tenant.is_active ? t('menuDeactivate') : t('menuActivate')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
