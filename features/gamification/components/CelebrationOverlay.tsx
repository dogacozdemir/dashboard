'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Particle ─────────────────────────────────────────────────────────────────

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
    x:     (Math.random() - 0.5) * 100, // % of viewport, from center
    y:     -(Math.random() * 70 + 20),  // % upward
    vx:    (Math.random() - 0.5) * 40,
    vy:    Math.random() * 40 + 60,
    rot:   Math.random() * 720 - 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size:  Math.random() * 8 + 4,
    shape: (['rect', 'circle', 'star'] as const)[Math.floor(Math.random() * 3)],
    delay: Math.random() * 0.4,
  }));
}

// ─── Achievement toast ────────────────────────────────────────────────────────

interface AchievementToastProps {
  icon:  string;
  title: string;
  desc:  string;
  xp:    number;
  onDone: () => void;
}

function AchievementToast({ icon, title, desc, xp, onDone }: AchievementToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ x: 60, opacity: 0, scale: 0.9 }}
      animate={{ x: 0,  opacity: 1, scale: 1 }}
      exit={{ x: 60, opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="fixed bottom-24 right-4 z-[999] md:bottom-6 md:right-6 max-w-xs w-full"
    >
      <div className="bg-[#16162a] border border-indigo-500/30 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 flex items-center justify-center text-xl shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">
            🏆 Yeni Başarı!
          </p>
          <p className="text-sm font-semibold text-white/90">{title}</p>
          <p className="text-xs text-white/40 mt-0.5">{desc}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs font-bold text-amber-400">+{xp} XP</span>
        </div>
      </div>
      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 rounded-full bg-indigo-500/60"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 4.3, ease: 'linear' }}
      />
    </motion.div>
  );
}

// ─── Event types ─────────────────────────────────────────────────────────────

export interface CelebrationDetail {
  type:     'confetti' | 'achievement';
  message?: string;
  achievement?: { icon: string; title: string; desc: string; xp: number };
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function CelebrationOverlay() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [toasts,    setToasts]    = useState<Array<CelebrationDetail['achievement'] & { id: number }>>([]);
  const toastId = useRef(0);

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

  useEffect(() => {
    window.addEventListener('mono:celebrate', handleCelebration);
    return () => window.removeEventListener('mono:celebrate', handleCelebration);
  }, [handleCelebration]);

  return (
    <>
      {/* Particles */}
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

      {/* Achievement toasts */}
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <AchievementToast
            key={t.id}
            icon={t.icon}
            title={t.title}
            desc={t.desc}
            xp={t.xp}
            onDone={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </AnimatePresence>
    </>
  );
}

// ─── Trigger helper (call from anywhere client-side) ─────────────────────────

export function triggerConfetti() {
  window.dispatchEvent(
    new CustomEvent<CelebrationDetail>('mono:celebrate', {
      detail: { type: 'confetti' },
    })
  );
}

export function triggerAchievementToast(achievement: {
  icon: string; title: string; desc: string; xp: number;
}) {
  window.dispatchEvent(
    new CustomEvent<CelebrationDetail>('mono:celebrate', {
      detail: { type: 'achievement', achievement },
    })
  );
}
