'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Globe, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getPublicRootDomainParts } from '@/lib/utils/public-root-domain';
import { cn } from '@/lib/utils/cn';
import { createTenant } from '../actions/fetchAdmin';
import { normalizeTenantSlug, tenantSlugIssue } from '../lib/tenant-slug';
import type { TenantPlan } from '@/types/tenant';

const spring = { type: 'spring' as const, stiffness: 280, damping: 26 };

type PlanOption = { value: TenantPlan; labelKey: 'planFree' | 'planGrowth' | 'planEnterprise' };

const PLAN_OPTIONS: PlanOption[] = [
  { value: 'starter', labelKey: 'planFree' },
  { value: 'growth', labelKey: 'planGrowth' },
  { value: 'enterprise', labelKey: 'planEnterprise' },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateTenantDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('Admin.tenantTable.create');
  const router = useRouter();
  const [name, setName] = useState('');
  const [slugRaw, setSlugRaw] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState<TenantPlan>('starter');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const slug = normalizeTenantSlug(slugRaw);
  const slugIssue = tenantSlugIssue(slug);
  const showSlugError = slugTouched && slugIssue !== null;

  const { host, port } = getPublicRootDomainParts();
  const previewUrl = slug ? `${slug}.${host}${port}` : `….${host}${port}`;

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && slugIssue === null && !pending;
  }, [name, slugIssue, pending]);

  function resetForm() {
    setName('');
    setSlugRaw('');
    setSlugTouched(false);
    setPlan('starter');
    setFormError(null);
  }

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlugRaw(normalizeTenantSlug(value));
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSlugTouched(true);
    setFormError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setFormError(t('errName'));
      return;
    }
    if (slugIssue) {
      setFormError(t(`errSlug_${slugIssue}`));
      return;
    }

    startTransition(async () => {
      const res = await createTenant({ slug, name: trimmedName, plan });
      if (!res.success) {
        const code = res.error ?? '';
        const mapped =
          code === 'SLUG_TAKEN'
            ? t('errSlugTaken')
            : code === 'SLUG_REQUIRED'
              ? t('errSlug_required')
              : code === 'SLUG_INVALID'
                ? t('errSlug_invalid')
                : code === 'SLUG_RESERVED'
                  ? t('errSlug_reserved')
                  : code === 'INVALID_NAME'
                    ? t('errName')
                    : (res.error ?? t('errGeneric'));
        setFormError(mapped);
        return;
      }
      resetForm();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          'sm:max-w-md gap-0 overflow-hidden rounded-[1.75rem] border border-white/[0.12]',
          'bg-[#161018]/95 p-0 text-white/90 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-3xl',
        )}
      >
        <form onSubmit={onSubmit}>
          <DialogHeader className="gap-2 border-b border-white/[0.08] px-6 py-5">
            <DialogTitle className="text-lg font-semibold tracking-tight text-white/95">
              {t('title')}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-white/40">
              {t('description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-1.5">
              <label htmlFor="tenant-name" className="text-xs font-medium text-white/45">
                {t('labelName')}
              </label>
              <input
                id="tenant-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                autoComplete="organization"
                placeholder={t('placeholderName')}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/25 focus:border-[#bea042]/40"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tenant-slug" className="text-xs font-medium text-white/45">
                {t('labelSlug')}
              </label>
              <input
                id="tenant-slug"
                value={slugRaw}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlugRaw(e.target.value.toLowerCase());
                }}
                onBlur={() => setSlugTouched(true)}
                autoComplete="off"
                spellCheck={false}
                placeholder={t('placeholderSlug')}
                aria-invalid={showSlugError}
                aria-describedby="tenant-slug-hint tenant-slug-error"
                className={cn(
                  'w-full rounded-2xl border bg-white/[0.05] px-4 py-2.5 font-mono text-sm text-white/90 outline-none transition-colors placeholder:text-white/25',
                  showSlugError
                    ? 'border-rose-400/40 focus:border-rose-400/60'
                    : 'border-white/[0.08] focus:border-[#bea042]/40',
                )}
              />
              <p id="tenant-slug-hint" className="flex items-center gap-1.5 text-[11px] text-white/30">
                <Globe className="size-3 shrink-0 text-indigo-400/70" />
                <span className="truncate">{previewUrl}</span>
              </p>
              {showSlugError && slugIssue && (
                <p id="tenant-slug-error" role="alert" className="text-xs text-rose-300/90">
                  {t(`errSlug_${slugIssue}`)}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tenant-plan" className="text-xs font-medium text-white/45">
                {t('labelPlan')}
              </label>
              <select
                id="tenant-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value as TenantPlan)}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm text-white/90 outline-none transition-colors focus:border-[#bea042]/40"
              >
                {PLAN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#161018]">
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200/90"
              >
                {formError}
              </motion.p>
            )}
          </div>

          <DialogFooter className="border-t border-white/[0.08] bg-white/[0.02] px-6 py-4 sm:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => onOpenChange(false)}
              className="rounded-2xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white/80 disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <motion.button
              type="submit"
              disabled={!canSubmit}
              whileHover={canSubmit ? { scale: 1.02 } : undefined}
              whileTap={canSubmit ? { scale: 0.98 } : undefined}
              transition={spring}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-semibold text-[#1a0f00] disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: 'linear-gradient(135deg, #e8d48a 0%, #bea042 55%, #a07b28 100%)',
                boxShadow: '0 0 20px rgba(190,160,66,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
                border: '1px solid rgba(139,110,30,0.45)',
              }}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {t('submit')}
            </motion.button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTenantButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('Admin.tenantTable.create');

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1a0f00]"
      style={{
        background: 'linear-gradient(135deg, #e8d48a 0%, #bea042 55%, #a07b28 100%)',
        boxShadow: '0 0 20px rgba(190,160,66,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
        border: '1px solid rgba(139,110,30,0.45)',
      }}
    >
      <Plus className="size-3.5" />
      {t('button')}
    </motion.button>
  );
}
