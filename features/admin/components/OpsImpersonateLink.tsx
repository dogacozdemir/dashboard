'use client';

import { useTransition } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getTenantDashboardUrl } from '@/lib/utils/tenant-urls';

const spring = { type: 'spring' as const, stiffness: 280, damping: 26 };

type Props = {
  tenantSlug: string;
  path: string;
  label?: string;
  className?: string;
  /** Icon-only control (still exposes accessible name). */
  iconOnly?: boolean;
};

export function OpsImpersonateLink({
  tenantSlug,
  path,
  label,
  className,
  iconOnly = false,
}: Props) {
  const t = useTranslations('Admin.tasks');
  const resolvedLabel = label ?? t('actionBrowse');
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/impersonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: tenantSlug }),
        });
        if (!res.ok) return;
        window.location.href = getTenantDashboardUrl(tenantSlug, path.startsWith('/') ? path : `/${path}`);
      } catch {
        /* noop */
      }
    });
  }

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      disabled={pending}
      onClick={onClick}
      title={resolvedLabel}
      aria-label={resolvedLabel}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur-xl hover:border-[#bea042]/40 hover:bg-white/[0.09] disabled:opacity-50 transition-colors'
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5 text-[#bea042]" />}
      {iconOnly ? null : resolvedLabel}
    </motion.button>
  );
}
