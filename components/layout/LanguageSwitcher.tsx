'use client';

import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { updateUserLocaleAction } from '@/features/i18n/actions/updateLocale';
import type { AppLocale } from '@/lib/i18n/constants';

const LABEL: Record<AppLocale, string> = { tr: 'TR', en: 'EN' };

export function LanguageSwitcher({ className }: { className?: string }) {
  const loc = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, start] = useTransition();

  const pick = (target: AppLocale) => {
    if (target === loc || pending) return;
    start(async () => {
      const r = await updateUserLocaleAction(target);
      if (r.ok) router.refresh();
    });
  };

  return (
    <div
      className={cn(
        'flex items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] p-0.5',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl',
        pending && 'pointer-events-none opacity-55',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {(['tr', 'en'] as const).map((code) => (
        <motion.button
          key={code}
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => pick(code)}
          className={cn(
            'relative min-w-[2.25rem] rounded-xl px-2.5 py-1 text-[10px] font-bold tracking-wide transition-colors',
            loc === code
              ? 'bg-gradient-to-br from-[#e8d48a] to-[#bea042] text-[#1a0f00]'
              : 'text-white/45 hover:text-white/75',
          )}
        >
          {LABEL[code]}
        </motion.button>
      ))}
    </div>
  );
}
