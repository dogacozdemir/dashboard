'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MADMONOS_SPRING } from '@/lib/motion/madmonos-motion';

const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: MADMONOS_SPRING,
  },
};

const shell = 'flex w-full min-w-0 flex-col gap-8';

/**
 * Wrap `CockpitStaggerSection` children so charts / KPI blocks reveal in sequence
 * (same spring language as the shell).
 */
export function CockpitHeavyStagger({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={shell}>{children}</div>;
  }
  return (
    <motion.div
      className={shell}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** One staggered block inside `CockpitHeavyStagger`. */
export function CockpitStaggerSection({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className="min-w-0">{children}</div>;
  }
  return (
    <motion.div variants={staggerItem} className="min-w-0">
      {children}
    </motion.div>
  );
}
