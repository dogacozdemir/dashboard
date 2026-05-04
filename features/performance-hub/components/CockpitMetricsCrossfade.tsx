'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CockpitPlatform } from '../lib/cockpit-platform';
import type { TimeRange } from '../actions/fetchMetrics';
import {
  MADMONOS_SPRING,
  madmonosCockpitCrossfadeVariants,
  madmonosReducedPageVariants,
  madmonosReducedTransition,
} from '@/lib/motion/madmonos-motion';

export function CockpitMetricsCrossfade({
  cockpit,
  range,
  children,
}: {
  cockpit: CockpitPlatform;
  range: TimeRange;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="relative isolate min-w-0 overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={`${cockpit}-${range}`}
          className="mm-cockpit-crossfade-will-change relative z-[1] min-w-0"
          variants={reduce ? madmonosReducedPageVariants : madmonosCockpitCrossfadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={reduce ? madmonosReducedTransition : MADMONOS_SPRING}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
