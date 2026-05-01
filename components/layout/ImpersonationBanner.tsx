'use client';

import { motion } from 'framer-motion';
import { Eye, LogOut, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ImpersonationBannerProps {
  tenantName: string;
  exitHref: string;
}

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

export function ImpersonationBanner({ tenantName, exitHref }: ImpersonationBannerProps) {
  const t = useTranslations('Layout');
  async function exitImpersonation() {
    try {
      await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: null }),
      });
    } catch {
      /* still navigate */
    }
    window.location.href = exitHref;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="relative z-20 mx-0 mb-2 rounded-[2rem] overflow-hidden shrink-0"
      style={{
        background: 'linear-gradient(135deg, rgba(190,160,66,0.22) 0%, rgba(212,180,76,0.14) 50%, rgba(160,123,40,0.18) 100%)',
        boxShadow:
          '0 0 40px rgba(190,160,66,0.25), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)',
        border: '1px solid rgba(190,160,66,0.45)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/[0.08] to-transparent animate-pulse" />
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(26,15,0,0.35)',
              border: '1px solid rgba(190,160,66,0.4)',
              boxShadow: '0 0 20px rgba(190,160,66,0.35)',
            }}
          >
            <Eye className="h-4 w-4 text-[#f5e6a8]" />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1a0f00]/70">
              <Sparkles className="h-3 w-3 text-[#8a6f20]" />
              {t('impersonationBadge')}
            </p>
            <p className="text-sm font-medium text-[#1a0f00] mt-0.5 leading-snug">
              {t('impersonationBody', { tenant: tenantName })}
            </p>
          </div>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          onClick={() => void exitImpersonation()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#1a0f00] shrink-0"
          style={{
            background: 'linear-gradient(180deg, #f0dc8a 0%, #bea042 100%)',
            boxShadow: '0 4px 20px rgba(190,160,66,0.45), inset 0 1px 0 rgba(255,255,255,0.5)',
            border: '1px solid rgba(139,110,30,0.5)',
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('exitImpersonation')}
        </motion.button>
      </div>
    </motion.div>
  );
}
