'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Sparkles,
  Zap,
  Target,
  Eye,
  Scale,
  ChevronRight,
  Loader2,
  TrendingUp,
  Crown,
} from 'lucide-react';
import {
  checkMagicSyncReady,
  runMagicQuickWins,
  completeMagicOnboarding,
} from '@/features/onboarding/actions/magicOnboardingActions';
import { DASHBOARD_CELEBRATE_STORAGE_KEY } from '@/features/onboarding/components/DashboardRevealMotion';
import type { DashboardGoal } from '@/types/tenant';
import { cn } from '@/lib/utils/cn';

const spring = { type: 'spring' as const, stiffness: 260, damping: 28, mass: 1 };

const AUDIT_LINES = [
  'Sektör trendleri ve talep sinyalleri taranıyor…',
  'Rakip stratejileri ve teklif dinamikleri eşleniyor…',
  'Kreatif skorlama motoru kalibre ediliyor…',
  'GEO ve arama görünürlüğü katmanları birleştiriliyor…',
  'Marka güveni ile dönüşüm yolları haritalanıyor…',
  'Öğrenilmiş raporlama omurgası senkrona kilitleniyor…',
];

interface Props {
  companyId: string;
  tenantName: string;
  connected?: string;
}

const GOALS: {
  id: DashboardGoal;
  title: string;
  subtitle: string;
  icon: typeof Zap;
}[] = [
  {
    id: 'sales',
    title: 'Hızlı satış',
    subtitle: 'ROAS ve gelir önceliği — dönüşüm ve büyüme.',
    icon: Zap,
  },
  {
    id: 'awareness',
    title: 'Marka bilinirliği',
    subtitle: 'Görünürlük ve erişim — gösterim & ilgi artışı.',
    icon: Eye,
  },
  {
    id: 'cost',
    title: 'Maliyet optimizasyonu',
    subtitle: 'CPA ve verim — aynı sonuç için daha akıllı harcama.',
    icon: Scale,
  },
];

export function MagicOnboardingExperience({ companyId, tenantName, connected }: Props) {
  const router = useRouter();
  const [lineIdx, setLineIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [syncReady, setSyncReady] = useState(false);
  const [hints, setHints] = useState<string[] | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncRef = useRef(false);
  const hintsRef = useRef<string[] | null>(null);
  useEffect(() => {
    syncRef.current = syncReady;
  }, [syncReady]);
  useEffect(() => {
    hintsRef.current = hints;
  }, [hints]);

  const auroraBlend = progress / 100;

  useEffect(() => {
    const id = setInterval(() => {
      setLineIdx((i) => (i + 1) % AUDIT_LINES.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void runMagicQuickWins(companyId).then((r) => {
      if (!cancelled) setHints(r.hints);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const ok = await checkMagicSyncReady(companyId);
        if (!cancelled && ok) setSyncReady(true);
      } catch {
        /* ignore */
      }
    };
    const interval = setInterval(tick, 2800);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [companyId]);

  useEffect(() => {
    const t0 = performance.now();
    const minMs = 9800;
    let raf = 0;

    function frame(now: number) {
      const elapsed = now - t0;
      const timeRatio = Math.min(1, elapsed / minMs);
      const hasHints = hintsRef.current !== null;
      const sync = syncRef.current;
      let p = timeRatio * 90;
      if (sync) p = Math.max(p, 88 + Math.min(10, (elapsed - minMs * 0.85) / 900 * 10));
      if (hasHints && elapsed > minMs - 500) p = Math.max(p, 94);
      if (hasHints && elapsed > minMs + 200) p = 100;
      if (hasHints && sync && elapsed > minMs - 300) p = Math.max(p, 98);
      if (elapsed > 26000 && hasHints) p = 100;
      if (elapsed > 40000) p = 100;
      setProgress(Math.min(100, p));
      if (p < 100) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const auditComplete = progress >= 99.5 && hints !== null;

  const onSelectGoal = useCallback(
    async (goal: DashboardGoal) => {
      setError(null);
      setSubmitting(true);
      try {
        const res = await completeMagicOnboarding(companyId, goal);
        if (!res.success) {
          setError(res.error ?? 'Kayıt başarısız.');
          setSubmitting(false);
          return;
        }
        try {
          sessionStorage.setItem(DASHBOARD_CELEBRATE_STORAGE_KEY, '1');
        } catch {
          /* ignore */
        }
        router.replace('/dashboard');
        router.refresh();
      } catch {
        setError('Bağlantı hatası.');
        setSubmitting(false);
      }
    },
    [companyId, router]
  );

  const orbStyle = useMemo(
    () => ({
      background: `conic-gradient(from 210deg, 
        rgba(156,112,178,${0.22 + auroraBlend * 0.12}) 0deg, 
        rgba(190,160,66,${0.18 + auroraBlend * 0.35}) 120deg, 
        rgba(120,80,160,${0.12 * (1 - auroraBlend * 0.5)}) 240deg, 
        rgba(156,112,178,${0.2 + auroraBlend * 0.1}) 360deg)`,
    }),
    [auroraBlend]
  );

  return (
    <div className="relative min-h-[72vh] flex flex-col items-center justify-center px-4 py-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 56, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[580px] h-[580px] rounded-full opacity-40"
          style={{
            ...orbStyle,
            filter: 'blur(64px)',
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.06 + auroraBlend * 0.04, 1],
            opacity: [0.12, 0.22 + auroraBlend * 0.18, 0.12],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[-80px] right-[-40px] w-[440px] h-[440px] rounded-full blur-[110px]"
          style={{
            background:
              auroraBlend < 0.5
                ? 'rgba(156,112,178,0.22)'
                : 'rgba(190,160,66,0.28)',
          }}
        />
        <motion.div
          className="absolute top-1/3 left-[-100px] w-[320px] h-[320px] rounded-full blur-[90px] opacity-30"
          style={{
            background: `rgba(190,160,66,${0.08 + auroraBlend * 0.2})`,
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring}
        className="relative z-10 w-full max-w-xl rounded-[2rem] p-8 md:p-10 space-y-7 shadow-2xl"
        style={{
          background: 'rgba(22, 12, 26, 0.52)',
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow:
            '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 36px 100px rgba(0,0,0,0.5), 0 0 140px rgba(190,160,66,0.06)',
          backdropFilter: 'blur(44px) saturate(200%)',
          WebkitBackdropFilter: 'blur(44px) saturate(200%)',
        }}
      >
        <div
          className="absolute top-0 left-10 right-10 h-px rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(190,160,66,${0.25 + auroraBlend * 0.35}), transparent)`,
          }}
        />

        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 4, -4, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(156,112,178,0.38), rgba(190,160,66,0.28))',
              border: '1px solid rgba(190,160,66,0.4)',
              boxShadow: `0 0 36px rgba(190,160,66,${0.12 + auroraBlend * 0.2})`,
            }}
          >
            <Brain className="h-7 w-7 text-white/92" />
          </motion.div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#bea042]" />
              Magic Onboarding · AI Brand Audit
            </p>
            <h1 className="text-lg md:text-xl font-semibold text-white/90 tracking-tight mt-1">
              {tenantName}
            </h1>
          </div>
        </div>

        {connected ? (
          <p className="text-xs text-emerald-400/85 flex items-center gap-2">
            <span className="capitalize font-semibold">{connected}</span>
            <span className="text-white/35">·</span>
            <span className="text-white/45">Bağlantı alındı — denetim katmanı aktif.</span>
          </p>
        ) : null}

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="audit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="min-h-[3rem] flex items-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={lineIdx}
                    initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                    transition={{ duration: 0.45 }}
                    className="text-sm md:text-[15px] text-white/65 leading-relaxed"
                  >
                    {AUDIT_LINES[lineIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/35">
                  <span className="flex items-center gap-1.5 text-[#bea042]/80">
                    <TrendingUp className="h-3 w-3" />
                    Denetim ilerlemesi
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
                      background:
                        'linear-gradient(90deg, rgba(156,112,178,0.95), rgba(190,160,66,0.98), rgba(232,212,138,0.9))',
                      boxShadow: '0 0 28px rgba(190,160,66,0.45)',
                    }}
                    transition={spring}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                    />
                  </motion.div>
                </div>
                <p className="text-[10px] text-white/28 text-center">
                  Frictionless veri köprüsü — çekilen ilk sinyaller MonoAI tarafından işleniyor.
                </p>
              </div>

              {auditComplete ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#bea042]/85 flex items-center gap-2">
                    <Crown className="h-3.5 w-3.5" />
                    Hızlı kazanımlar · Quick Wins
                  </p>
                  <ul className="space-y-2.5">
                    {hints!.map((h, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 * i, ...spring }}
                        className="text-xs text-white/70 leading-relaxed flex gap-2"
                      >
                        <span className="text-[#bea042]/90 font-mono text-[10px] mt-0.5">{i + 1}.</span>
                        <span>{h}</span>
                      </motion.li>
                    ))}
                  </ul>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep(2)}
                    className="w-full mt-2 rounded-2xl py-3 text-xs font-semibold text-[#1a0f00] flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #e8d48a, #bea042)',
                      border: '1px solid rgba(190,160,66,0.5)',
                      boxShadow: '0 0 24px rgba(190,160,66,0.22)',
                    }}
                  >
                    Stratejiyi seç
                    <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </motion.div>
              ) : (
                <p className="text-[11px] text-white/25 text-center pt-1">
                  İpucu motoru veri omurgasına bağlanıyor…
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="goals"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="text-center space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  Önceliğiniz hangisi?
                </p>
                <p className="text-sm text-white/55">
                  Seçiminiz dashboard&apos;un ilk düzenini ve vurgularını kişiselleştirir.
                </p>
              </div>

              <div className="grid gap-3">
                {GOALS.map((g, idx) => {
                  const Icon = g.icon;
                  return (
                    <motion.button
                      key={g.id}
                      type="button"
                      disabled={submitting}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06, ...spring }}
                      whileHover={{ scale: submitting ? 1 : 1.015 }}
                      whileTap={{ scale: submitting ? 1 : 0.985 }}
                      onClick={() => void onSelectGoal(g.id)}
                      className={cn(
                        'rounded-2xl p-4 text-left flex gap-4 items-start border transition-colors',
                        'border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#bea042]/35',
                        submitting && 'opacity-50 pointer-events-none'
                      )}
                    >
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: 'rgba(190,160,66,0.12)',
                          border: '1px solid rgba(190,160,66,0.25)',
                        }}
                      >
                        <Icon className="h-5 w-5 text-[#bea042]/90" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white/88 flex items-center gap-2">
                          {g.title}
                          <Target className="h-3.5 w-3.5 text-white/25" />
                        </p>
                        <p className="text-xs text-white/45 mt-1 leading-relaxed">{g.subtitle}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {error ? (
                <p className="text-xs text-rose-400/90 text-center">{error}</p>
              ) : null}
              {submitting ? (
                <p className="text-xs text-white/35 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#bea042]" />
                  Panonuz kişiselleştiriliyor…
                </p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
