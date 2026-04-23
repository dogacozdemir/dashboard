'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  glow?:    'indigo' | 'cyan' | 'violet' | 'none';
  hover?:   boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Adds an animated gradient border */
  gradientBorder?: boolean;
}

const paddingMap = {
  none: '',
  sm:   'p-4',
  md:   'p-5 md:p-6',
  lg:   'p-6 md:p-8',
};

const glowMap = {
  none:   '',
  indigo: 'glow-indigo',
  cyan:   'glow-cyan',
  violet: 'glow-violet',
};

export function GlassCard({
  children,
  className,
  glow         = 'none',
  hover        = false,
  padding      = 'md',
  gradientBorder = false,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        'glass glow-inset rounded-2xl',
        paddingMap[padding],
        glowMap[glow],
        hover && 'glass-hover cursor-pointer',
        gradientBorder && 'gradient-border',
        className,
      )}
      whileHover={hover ? { y: -2, scale: 1.005 } : undefined}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
