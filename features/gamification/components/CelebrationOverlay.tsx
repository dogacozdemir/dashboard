'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

// ─── Confetti particles ───────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#f97316', '#14b8a6',
];

interface Particle {
  id:     number;
  x:      number;
  y:      number;
  vx:     number;
  vy:     number;
  rot:    number;
  color:  string;
  size:   number;
  shape:  'rect' | 'circle' | 'star';
  delay:  number;
}

function makeParticles(count = 50): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id:    i,
    x:     (Math.random() - 0.5) * 100,
    y:     -(Math.random() * 70 + 20),
    vx:    (Math.random() - 0.5) * 40,
    vy:    Math.random() * 40 + 60,
    rot:   Math.random() * 720 - 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size:  Math.random() * 8 + 4,
    shape: (['rect', 'circle', 'star'] as const)[Math.floor(Math.random() * 3)],
    delay: Math.random() * 0.4,
  }));
}

// ─── Golden dust (level up) ───────────────────────────────────────────────────

interface GoldParticle {
  id:       number;
  leftPct:  number;
  delay:    number;
  duration: number;
  size:     number;
  drift:    number;
}

function makeGoldDust(count = 88): GoldParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id:       i,
    leftPct:  Math.random() * 100,
    delay:    Math.random() * 0.55,
    duration: 2.1 + Math.random() * 1.6,
    size:     Math.random() * 2.8 + 0.8,
    drift:    (Math.random() - 0.5) * 28,
  }));
}

// ─── Achievement toast ────────────────────────────────────────────────────────

interface AchievementToastProps {
  icon:           string;
  achievementKey: string;
  xp:             number;
  onDone:         () => void;
}

function AchievementToast({ icon, achievementKey, xp, onDone }: AchievementToastProps) {
  const t = useTranslations('Features.Gamification');
  const title = t(`achievements.${achievementKey}.title` as Parameters<typeof t>[0]);
  const desc  = t(`achievements.${achievementKey}.desc` as Parameters<typeof t>[0]);

  useEffect(() => {
    const timer = setTimeout(onDone, 4500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ x: 60, opacity: 0, scale: 0.9 }}
      animate={{ x: 0,  opacity: 1, scale: 1 }}
      exit={{ x: 60, opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="fixed bottom-24 right-4 z-[999] md:bottom-6 md:right-6 max-w-xs w-full"
    >
      <div
        className="relative overflow-hidden rounded-[2rem] border border-white/10 p-4 shadow-2xl flex items-start gap-3 backdrop-blur-3xl"
        style={{
          background: 'rgba(22, 22, 42, 0.55)',
          boxShadow: '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 20px 50px rgba(0,0,0,0.45), 0 0 40px rgba(99,102,241,0.15)',
        }}
      >
        <div className="pointer-events-none absolute -inset-6 rounded-full bg-indigo-500/15 blur-2xl" aria-hidden />
        <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/35 to-violet-500/20 border border-white/10 flex items-center justify-center text-xl shrink-0 shadow-[0_0_24px_rgba(99,102,241,0.35)]">
          {icon}
        </div>
        <div className="relative min-w-0">
          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-0.5">
            {t('toastNewAchievement')}
          </p>
          <p className="text-sm font-semibold text-white/90 line-clamp-2">{title}</p>
          <p className="text-xs text-white/40 mt-0.5 line-clamp-3">{desc}</p>
        </div>
        <div className="relative shrink-0 text-right">
          <span className="text-xs font-bold text-amber-300">+{xp} {t('xpLabel')}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Level up banner ───────────────────────────────────────────────────────────

interface LevelUpToastProps {
  from:   number;
  to:     number;
  onDone: () => void;
}

function LevelUpToast({ from, to, onDone }: LevelUpToastProps) {
  const t = useTranslations('Features.Gamification');

  useEffect(() => {
    const timer = setTimeout(onDone, 4200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -12 }}
      transition={{ type: 'spring', damping: 18, stiffness: 280 }}
      className="fixed left-1/2 top-[min(28%,200px)] z-[998] w-[min(92vw,380px)] -translate-x-1/2 pointer-events-none"
    >
      <div
        className="relative overflow-hidden rounded-[2rem] border border-[#bea042]/35 px-6 py-5 text-center backdrop-blur-3xl"
        style={{
          background: 'linear-gradient(145deg, rgba(26,15,8,0.88), rgba(18,10,22,0.82))',
          boxShadow:
            '0 0 0 0.5px rgba(190,160,66,0.25) inset, 0 24px 80px rgba(0,0,0,0.55), 0 0 80px rgba(190,160,66,0.2)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(190,160,66,0.35), transparent 55%)',
          }}
          aria-hidden
        />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.35em] text-[#e8d48a]/90 mb-2">
          {t('levelUpBadge')}
        </p>
        <p className="relative text-2xl font-black text-white/95 tracking-tight">
          {t('levelUpTitle', { from, to })}
        </p>
        <p className="relative text-xs text-white/45 mt-2">{t('levelUpSubtitle')}</p>
      </div>
    </motion.div>
  );
}

// ─── Event types ─────────────────────────────────────────────────────────────

export interface CelebrationDetail {
  type:     'confetti' | 'achievement';
  message?: string;
  achievement?: { icon: string; achievementKey: string; xp: number };
}

export interface LevelUpDetail {
  from: number;
  to:   number;
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function CelebrationOverlay() {
  const [particles, setParticles]     = useState<Particle[]>([]);
  const [goldDust, setGoldDust]       = useState<GoldParticle[]>([]);
  const [toasts, setToasts]           = useState<Array<{ id: number; icon: string; achievementKey: string; xp: number }>>([]);
  const [levelUps, setLevelUps]       = useState<Array<{ id: number; from: number; to: number }>>([]);
  const toastId   = useRef(0);
  const levelUpId = useRef(0);

  const handleCelebration = useCallback((e: Event) => {
    const detail = (e as CustomEvent<CelebrationDetail>).detail;

    if (detail.type === 'confetti' || detail.type === 'achievement') {
      setParticles(makeParticles(60));
      setTimeout(() => setParticles([]), 2500);
    }

    if (detail.type === 'achievement' && detail.achievement) {
      const id = ++toastId.current;
      setToasts((prev) => [...prev, { ...detail.achievement!, id }]);
    }
  }, []);

  const handleLevelUp = useCallback((e: Event) => {
    const detail = (e as CustomEvent<LevelUpDetail>).detail;
    setGoldDust(makeGoldDust(96));
    setTimeout(() => setGoldDust([]), 3400);
    const id = ++levelUpId.current;
    setLevelUps((prev) => [...prev, { id, from: detail.from, to: detail.to }]);
  }, []);

  useEffect(() => {
    window.addEventListener('mono:celebrate', handleCelebration);
    window.addEventListener('mono:level-up', handleLevelUp);
    return () => {
      window.removeEventListener('mono:celebrate', handleCelebration);
      window.removeEventListener('mono:level-up', handleLevelUp);
    };
  }, [handleCelebration, handleLevelUp]);

  return (
    <>
      <AnimatePresence>
        {particles.length > 0 && (
          <div className="fixed inset-0 z-[900] pointer-events-none overflow-hidden">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: '50vw', y: '50vh', opacity: 1, rotate: 0, scale: 1 }}
                animate={{
                  x:       `calc(50vw + ${p.x}vw)`,
                  y:       `calc(50vh + ${p.y}vh)`,
                  opacity: [1, 1, 0],
                  rotate:  p.rot,
                  scale:   [1, 0.8],
                }}
                transition={{
                  duration: 1.4 + p.delay,
                  delay:    p.delay * 0.3,
                  ease:     [0.2, 0.8, 0.4, 1],
                }}
                style={{
                  position:        'absolute',
                  width:           p.size,
                  height:          p.shape === 'rect' ? p.size * 0.5 : p.size,
                  backgroundColor: p.color,
                  borderRadius:    p.shape === 'circle' ? '50%' : p.shape === 'rect' ? 2 : 0,
                  clipPath:        p.shape === 'star'
                    ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                    : undefined,
                  top:  0,
                  left: 0,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {goldDust.length > 0 && (
          <div className="fixed inset-0 z-[901] pointer-events-none overflow-hidden">
            {goldDust.map((g) => (
              <motion.div
                key={g.id}
                initial={{
                  left:   `${g.leftPct}vw`,
                  bottom: '-4vh',
                  opacity: 0.95,
                  x:      0,
                }}
                animate={{
                  bottom: ['6vh', '92vh'],
                  opacity: [0.9, 0],
                  x:      [0, g.drift],
                }}
                transition={{
                  duration: g.duration,
                  delay:    g.delay,
                  ease:     [0.12, 0.55, 0.2, 1],
                }}
                className="absolute rounded-full"
                style={{
                  width:           g.size,
                  height:          g.size,
                  background:
                    'radial-gradient(circle at 30% 30%, #fff6d4, #bea042 45%, rgba(160,120,40,0.2) 70%)',
                  boxShadow: '0 0 12px rgba(255,230,180,0.9), 0 0 22px rgba(190,160,66,0.45)',
                  filter:    'blur(0.2px)',
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <AchievementToast
            key={toast.id}
            icon={toast.icon}
            achievementKey={toast.achievementKey}
            xp={toast.xp}
            onDone={() => setToasts((prev) => prev.filter((x) => x.id !== toast.id))}
          />
        ))}
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        {levelUps.map((row) => (
          <LevelUpToast
            key={row.id}
            from={row.from}
            to={row.to}
            onDone={() => setLevelUps((prev) => prev.filter((x) => x.id !== row.id))}
          />
        ))}
      </AnimatePresence>
    </>
  );
}

// ─── Trigger helpers ─────────────────────────────────────────────────────────

export function triggerConfetti() {
  window.dispatchEvent(
    new CustomEvent<CelebrationDetail>('mono:celebrate', {
      detail: { type: 'confetti' },
    })
  );
}

export function triggerAchievementToast(payload: {
  icon: string;
  achievementKey: string;
  xp: number;
}) {
  window.dispatchEvent(
    new CustomEvent<CelebrationDetail>('mono:celebrate', {
      detail: { type: 'achievement', achievement: payload },
    })
  );
}

export function triggerLevelUp(payload: { from: number; to: number }) {
  window.dispatchEvent(
    new CustomEvent<LevelUpDetail>('mono:level-up', {
      detail: payload,
    })
  );
}
