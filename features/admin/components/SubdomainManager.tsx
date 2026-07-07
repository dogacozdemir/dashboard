'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Globe,
  Loader2,
  Lock,
  Pencil,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassCard } from '@/components/shared/GlassCard';
import { getPublicRootDomainParts } from '@/lib/utils/public-root-domain';
import { cn } from '@/lib/utils/cn';
import { customDomainIssue, normalizeCustomDomainInput } from '../lib/custom-domain';
import { updateTenantCustomDomain } from '../actions/fetchAdmin';
import type { TenantWithStats } from '../types';

const spring = { type: 'spring' as const, stiffness: 280, damping: 26 };

type Props = {
  tenants: TenantWithStats[];
  rootHost: string;
};

type EditTarget = Pick<TenantWithStats, 'id' | 'name' | 'slug' | 'custom_domain'>;

export function SubdomainManager({ tenants, rootHost }: Props) {
  const t = useTranslations('Admin.subdomainRegistry');
  const router = useRouter();
  const [rows, setRows] = useState(tenants);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setRows(tenants);
  }, [tenants]);

  const normalizedInput = useMemo(() => normalizeCustomDomainInput(domainInput), [domainInput]);
  const domainIssue = customDomainIssue(normalizedInput);
  const canSave = !pending && domainIssue === null;

  function openEdit(tenant: TenantWithStats) {
    setEditTarget({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      custom_domain: tenant.custom_domain,
    });
    setDomainInput(tenant.custom_domain ?? '');
    setFormError(null);
  }

  function closeEdit() {
    setEditTarget(null);
    setDomainInput('');
    setFormError(null);
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !canSave) return;
    setFormError(null);

    startTransition(async () => {
      const res = await updateTenantCustomDomain(editTarget.id, domainInput);
      if (!res.success) {
        const mapped =
          res.error === 'DOMAIN_INVALID'
            ? t('errDomainInvalid')
            : res.error === 'DOMAIN_TAKEN'
              ? t('errDomainTaken')
              : t('errGeneric');
        setFormError(mapped);
        return;
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === editTarget.id ? { ...row, custom_domain: res.customDomain } : row,
        ),
      );
      closeEdit();
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent
          className={cn(
            'gap-0 overflow-hidden rounded-[1.75rem] border border-white/[0.12] p-0 sm:max-w-md',
            'bg-[#161018]/95 text-white/90 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-3xl',
          )}
        >
          <form onSubmit={onSave}>
            <DialogHeader className="gap-2 border-b border-white/[0.08] px-6 py-5">
              <DialogTitle className="text-lg font-semibold tracking-tight text-white/95">
                {t('editTitle')}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-white/40">
                {t('editDescription', { tenant: editTarget?.name ?? '' })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {t('defaultSubdomain')}
                </p>
                <p className="mt-1 font-mono text-sm text-indigo-300/90">
                  {editTarget?.slug}.{rootHost}
                </p>
                <p className="mt-1.5 text-[11px] text-emerald-300/70">{t('wildcardNote')}</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="custom-domain" className="text-xs font-medium text-white/45">
                  {t('customDomainLabel')}
                </label>
                <input
                  id="custom-domain"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder={t('customDomainPlaceholder')}
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 font-mono text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-[#bea042]/40"
                />
                <p className="text-[11px] text-white/30">{t('customDomainHint')}</p>
              </div>

              {formError && (
                <p role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200/90">
                  {formError}
                </p>
              )}
            </div>

            <DialogFooter className="border-t border-white/[0.08] bg-white/[0.02] px-6 py-4 sm:justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={closeEdit}
                className="rounded-2xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white/80 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <motion.button
                type="submit"
                disabled={!canSave}
                whileHover={canSave ? { scale: 1.02 } : undefined}
                whileTap={canSave ? { scale: 0.98 } : undefined}
                transition={spring}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-semibold text-[#1a0f00] disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  background: 'linear-gradient(135deg, #e8d48a 0%, #bea042 55%, #a07b28 100%)',
                  boxShadow: '0 0 20px rgba(190,160,66,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
                  border: '1px solid rgba(139,110,30,0.45)',
                }}
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {t('save')}
              </motion.button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <GlassCard padding="none">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-sm font-semibold text-white/80">{t('title')}</h3>
          <p className="mt-0.5 text-xs text-white/30">{t('subtitle')}</p>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {rows.map((tenant, i) => {
            const defaultHost = `${tenant.slug}.${rootHost}`;
            const hasCustom = !!tenant.custom_domain;

            return (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                    <Globe className="h-4 w-4 text-indigo-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/80">{tenant.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-indigo-400/90">{defaultHost}</p>
                    {hasCustom ? (
                      <>
                        <p className="mt-1 font-mono text-xs text-[#bea042]/90">{tenant.custom_domain}</p>
                        <p className="mt-0.5 text-[10px] text-white/25">{t('customDnsNote')}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-[10px] text-white/25">{t('noCustomDomain')}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300/90">
                    <ShieldCheck className="h-3 w-3" />
                    {t('wildcardSsl')}
                  </span>

                  {hasCustom && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200/80">
                      <Lock className="h-3 w-3" />
                      {t('customDomainBadge')}
                    </span>
                  )}

                  {tenant.is_active ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400/90">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('live')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-400/90">
                      <XCircle className="h-3.5 w-3.5" />
                      {t('inactive')}
                    </span>
                  )}

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    onClick={() => openEdit(tenant)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-white/70 transition-colors hover:border-white/20 hover:text-white/90"
                  >
                    <Pencil className="h-3 w-3" />
                    {t('editDomain')}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </GlassCard>
    </>
  );
}
