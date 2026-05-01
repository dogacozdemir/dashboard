'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useDragControls } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type Props = {
  title: string;
  children: ReactNode;
};

/**
 * On viewports &lt; md: content in a drag-to-dismiss bottom sheet with handle.
 * md+: plain block (no chrome).
 */
export function MobileFirstSheet({ title, children }: Props) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const dragControls = useDragControls();
  const t = useTranslations('Layout');

  if (!isMobile) {
    return <div className="h-full min-h-0">{children}</div>;
  }

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)))] flex-col rounded-t-[1.75rem] border-t border-white/10"
      style={{
        background: 'rgba(12, 7, 12, 0.94)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        boxShadow: '0 -24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      initial={{ y: '18%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0 }}
      dragElastic={{ top: 0, bottom: 0.35 }}
      onDragEnd={(_, info) => {
        if (info.velocity.y > 420 || info.offset.y > 96) {
          if (window.history.length > 1) router.back();
          else router.push('/dashboard');
        }
      }}
    >
      <button
        type="button"
        aria-label={t('mobileSheetDragClose', { title })}
        onPointerDown={(e) => dragControls.start(e)}
        className="shrink-0 flex w-full touch-none flex-col items-center gap-2 pb-2 pt-3 cursor-grab active:cursor-grabbing"
      >
        <span className="h-1.5 w-11 rounded-full bg-white/25" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          {title}
        </span>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 scrollbar-thin">
        {children}
      </div>
    </motion.div>
  );
}
