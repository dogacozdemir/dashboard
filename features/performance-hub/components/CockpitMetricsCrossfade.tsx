'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { CockpitPlatform } from '../lib/cockpit-platform';
import type { TimeRange } from '../actions/fetchMetrics';

export function CockpitMetricsCrossfade({
  cockpit,
  range,
  children,
}: {
  cockpit: CockpitPlatform;
  range: TimeRange;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={`${cockpit}-${range}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
