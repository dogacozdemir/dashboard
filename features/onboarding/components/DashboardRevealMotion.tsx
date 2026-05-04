'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MADMONOS_SPRING } from '@/lib/motion/madmonos-motion';

export const DASHBOARD_CELEBRATE_STORAGE_KEY = 'mm_dashboard_celebrate';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.065, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: MADMONOS_SPRING,
  },
};

interface Props {
  /** Dashboard blocks to stagger-reveal after Magic Onboarding (use stable keys on items if list). */
  sections: ReactNode[];
}

/**
 * One-shot staggered reveal after Magic Onboarding completes (sessionStorage flag).
 */
export function DashboardRevealMotion({ sections }: Props) {
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem(DASHBOARD_CELEBRATE_STORAGE_KEY)) {
        sessionStorage.removeItem(DASHBOARD_CELEBRATE_STORAGE_KEY);
        setCelebrate(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!celebrate) {
    return (
      <div className="space-y-6">
        {sections.map((block, i) => (
          <div key={`dashboard-section-${i}`}>{block}</div>
        ))}
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      {sections.map((block, i) => (
        <motion.div key={`dashboard-section-${i}`} variants={item}>
          {block}
        </motion.div>
      ))}
    </motion.div>
  );
}
