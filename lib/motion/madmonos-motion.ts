import type { Transition, Variants } from 'framer-motion';

/** Unified “Madmonos spring” — dampened, high-end route / widget motion. */
export const MADMONOS_SPRING: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 22,
  mass: 1,
};

/** Full-page / shell liquid glass (opacity + scale + blur). */
export const madmonosLiquidPageVariants: Variants = {
  initial: { opacity: 0, scale: 0.98, filter: 'blur(10px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.02, filter: 'blur(10px)' },
};

/** Cockpit inner crossfade — same spring, no extra blur (avoids stacking with shell). */
export const madmonosCockpitCrossfadeVariants: Variants = {
  initial: { opacity: 0, scale: 0.985 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.985 },
};

export const madmonosReducedPageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const madmonosReducedTransition: Transition = { duration: 0.18, ease: 'easeOut' };
