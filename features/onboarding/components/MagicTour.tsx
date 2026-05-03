'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  Trophy,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export const TOUR_STORAGE_KEY = 'madmonos.magicTour.v1';

const STEP_ICONS = [LayoutDashboard, BarChart3, Clapperboard, Trophy];
const STEP_COLORS = [
  { ring: 'from-[#9c70b2]/60 to-[#bea042]/40', glow: 'rgba(156,112,178,0.28)', icon: '#b48dc8' },
  { ring: 'from-cyan-500/50 to-[#9c70b2]/40',  glow: 'rgba(6,182,212,0.22)',   icon: '#67e8f9' },
  { ring: 'from-violet-500/50 to-indigo-500/40', glow: 'rgba(139,92,246,0.22)', icon: '#c4b5fd' },
  { ring: 'from-[#bea042]/60 to-amber-400/40',  glow: 'rgba(190,160,66,0.28)', icon: '#fcd34d' },
];

const spring = { type: 'spring' as const, stiffness: 280, damping: 26, mass: 0.9 };

interface MagicTourProps {
  /** Auto-show on mount when true (new tenant) */
  autoShow?: boolean;
}

export function MagicTour({ autoShow = false }: MagicTourProps) {
  const t = useTranslations('MagicTour');
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const TOTAL = 4;

  useEffect(() => {
    if (!autoShow) return;
    try {
      const done = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!done) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [autoShow]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(TOUR_STORAGE_KEY, '1'); } catch { /* noop */ }
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (step < TOTAL) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const stepData = useMemo(() => {
    const key = String(step) as '1' | '2' | '3' | '4';
    return {
      tag: t(`steps.${key}.tag`),
      title: t(`steps.${key}.title`),
      body: t(`steps.${key}.body`),
    };
  }, [step, t]);

  const color = STEP_COLORS[step - 1];
  const Icon = STEP_ICONS[step - 1];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="magic-tour-backdrop"
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-[#0c070c]/70 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Card */}
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={spring}
            className="relative z-10 w-full max-w-sm rounded-[2rem] p-7 md:p-8 overflow-hidden"
            style={{
              background: 'rgba(22, 11, 22, 0.88)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: `0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(0,0,0,0.6), 0 0 80px ${color.glow}`,
              backdropFilter: 'blur(60px) saturate(220%)',
              WebkitBackdropFilter: 'blur(60px) saturate(220%)',
            }}
          >
            {/* Top rim light */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2rem] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Close */}
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('skip')}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/40 transition-colors hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Icon badge */}
            <div className="mb-6">
              <div
                className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${color.glow.replace('0.28', '0.22')}, rgba(255,255,255,0.03))`,
                  border: `1px solid ${color.glow.replace('rgba', 'rgba').replace('0.28', '0.45')}`,
                  boxShadow: `0 0 28px ${color.glow}`,
                }}
              >
                <Icon className="h-6 w-6" style={{ color: color.icon }} />
              </div>
            </div>

            {/* Tag */}
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-[#bea042] shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {stepData.tag}
              </span>
            </div>

            {/* Title */}
            <h2 className="mb-3 text-xl font-bold leading-tight tracking-tight text-white/90">
              {stepData.title}
            </h2>

            {/* Body */}
            <p className="mb-8 text-sm leading-relaxed text-white/50">
              {stepData.body}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              {/* Step indicator */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Step ${i + 1}`}
                    onClick={() => setStep(i + 1)}
                    className="transition-all"
                    style={{
                      width: step === i + 1 ? 20 : 6,
                      height: 6,
                      borderRadius: 9999,
                      background:
                        step === i + 1
                          ? color.icon
                          : step > i + 1
                          ? 'rgba(255,255,255,0.4)'
                          : 'rgba(255,255,255,0.12)',
                    }}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {step < TOTAL && (
                  <button
                    type="button"
                    onClick={dismiss}
                    className="text-[11px] text-white/30 transition-colors hover:text-white/55"
                  >
                    {t('skip')}
                  </button>
                )}
                <motion.button
                  type="button"
                  onClick={next}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white/90 shadow-lg transition"
                  style={{
                    background: `linear-gradient(135deg, ${color.glow.replace('0.28', '0.85')}, rgba(156,112,178,0.7))`,
                    boxShadow: `0 4px 20px ${color.glow}`,
                  }}
                >
                  {step < TOTAL ? t('next') : t('done')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Programmatic open: clear the tour key and reload — used by Profile "restart tour" button.
 */
export function restartMagicTour() {
  try { localStorage.removeItem(TOUR_STORAGE_KEY); } catch { /* noop */ }
  window.location.reload();
}

/**
 * Small client button rendered in the Profile page.
 */
export function RestartTourButton() {
  const t = useTranslations('Features.Profile');
  return (
    <button
      type="button"
      onClick={restartMagicTour}
      className="flex items-center gap-2 rounded-xl border border-[#bea042]/30 bg-[#bea042]/8 px-4 py-2 text-sm font-medium text-[#bea042]/90 transition hover:border-[#bea042]/55 hover:text-[#bea042]"
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      {t('tourRestart')}
    </button>
  );
}

/**
 * Check client-side whether tour has been completed.
 * Safe to call only in client components (after hydration).
 */
export function isTourCompleted(): boolean {
  try { return Boolean(localStorage.getItem(TOUR_STORAGE_KEY)); } catch { return false; }
}

export type { MagicTourProps };

