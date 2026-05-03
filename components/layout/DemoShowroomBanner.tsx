'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

export function DemoShowroomBanner() {
  const t = useTranslations('Dashboard.shell');

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      role="status"
      aria-live="polite"
      className="relative z-20 mx-0 mb-2 shrink-0 overflow-hidden rounded-[2rem]"
      style={{
        background:
          'linear-gradient(135deg, rgba(190,160,66,0.18) 0%, rgba(156,112,178,0.14) 48%, rgba(190,160,66,0.12) 100%)',
        boxShadow:
          '0 0 36px rgba(190,160,66,0.22), inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.18)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>
      <div className="relative flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-[#bea042] shadow-inner">
          <Sparkles className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bea042]/95">
            {t('showroomBadge')}
          </p>
          <p className="text-xs text-white/55 mt-0.5 leading-snug">{t('showroomLine')}</p>
        </div>
      </div>
    </motion.div>
  );
}
