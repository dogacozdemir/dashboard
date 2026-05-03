'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Orbit, Sparkles } from 'lucide-react';
import type { MonoWelcomeCopy } from '@/features/onboarding/actions/welcomeCopy';
import Link from 'next/link';
import { TenantLogoMark } from '@/components/branding/TenantLogoMark';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

interface Props {
  copy: MonoWelcomeCopy;
  tenantName: string;
  /** Post-login welcome: tenant white-label mark when configured. */
  brandLogoUrl?: string | null;
}

export function MonoAiWelcomeClient({ copy, tenantName, brandLogoUrl }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    function tick(now: number) {
      const elapsed = now - t0;
      const target = Math.min(100, (elapsed / 9000) * 100);
      setProgress(target);
      if (target < 100) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 py-8">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full opacity-30"
          style={{
            background: 'conic-gradient(from 0deg, rgba(156,112,178,0.35), rgba(190,160,66,0.25), rgba(6,182,212,0.2), rgba(156,112,178,0.35))',
            filter: 'blur(60px)',
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.28, 0.15] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-amber-500/[0.12] blur-[100px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="relative z-10 w-full max-w-2xl rounded-[2rem] p-8 md:p-10 space-y-8"
        style={{
          background: 'rgba(29, 15, 29, 0.42)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow:
            '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(0,0,0,0.45), 0 0 120px rgba(156,112,178,0.08)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        }}
      >
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#bea042]/40 to-transparent rounded-full" />

        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(156,112,178,0.35), rgba(190,160,66,0.22))',
              border: '1px solid rgba(190,160,66,0.35)',
              boxShadow: '0 0 32px rgba(156,112,178,0.25)',
            }}
          >
            {brandLogoUrl?.trim() ? (
              <TenantLogoMark
                brandLogoUrl={brandLogoUrl}
                alt={tenantName}
                width={36}
                height={36}
                className="h-9 w-9"
              />
            ) : (
              <Brain className="h-7 w-7 text-white/90" />
            )}
          </motion.div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#bea042]" />
              MonoAI · First flight
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-white/90 tracking-tight mt-1">
              {copy.headline}
            </h1>
          </div>
        </div>

        <p className="text-sm md:text-base text-white/55 leading-relaxed">
          {copy.subline}
        </p>

        <div className="rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/[0.08]">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#bea042]/80 mb-1">
            Sektör bağlamı
          </p>
          <p className="text-sm text-white/70">{copy.sector}</p>
          <p className="text-[11px] text-white/30 mt-1">{tenantName} · Brand Mono</p>
        </div>

        {/* Liquid progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/35">
            <span className="flex items-center gap-1.5">
              <Orbit className="h-3 w-3 text-cyan-400/80 animate-spin" style={{ animationDuration: '2.8s' }} />
              AI Strategy · Veri senkronu
            </span>
            <span className="tabular-nums text-white/45">{Math.round(progress)}%</span>
          </div>
          <div
            className="h-3 rounded-full overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.35)',
            }}
          >
            <motion.div
              className="h-full rounded-full relative overflow-hidden"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, rgba(156,112,178,0.9), rgba(190,160,66,0.95), rgba(6,182,212,0.85))',
                boxShadow: '0 0 24px rgba(190,160,66,0.45)',
              }}
              transition={spring}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
            </motion.div>
          </div>
          <p className="text-[11px] text-white/28 text-center">
            Meta / Google / TikTok bağladığınız anda AI Brand Audit ve strateji adımları açılır — ardından panonuz hedefinize göre şekillenir.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Link
            href="/performance"
            className="rounded-2xl px-5 py-2.5 text-xs font-semibold text-white/85 transition-colors"
            style={{
              background: 'rgba(156,112,178,0.2)',
              border: '1px solid rgba(156,112,178,0.35)',
            }}
          >
            Entegrasyonlara git
          </Link>
          <Link
            href="/mono-ai"
            className="rounded-2xl px-5 py-2.5 text-xs font-semibold text-[#1a0f00] transition-opacity hover:opacity-95"
            style={{
              background: 'linear-gradient(135deg, #e8d48a, #bea042)',
              border: '1px solid rgba(190,160,66,0.5)',
              boxShadow: '0 0 20px rgba(190,160,66,0.25)',
            }}
          >
            MonoAI ile konuş
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
