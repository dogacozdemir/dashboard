'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  Brain,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Native-style bottom tab bar — visible only on mobile (md:hidden).
 * Mirrors the most-used 5 destinations without requiring a drawer.
 * Uses spring-animated active pill + scale feedback on press.
 */

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Overview',   icon: LayoutDashboard },
  { href: '/performance', label: 'Stats',       icon: BarChart3 },
  { href: '/creative',    label: 'Creative',    icon: Clapperboard },
  { href: '/mono-ai',     label: 'Mono AI',     icon: Brain },
  { href: '/calendar',    label: 'Calendar',    icon: CalendarDays },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-50',
        'flex items-center justify-around',
        'px-2 pb-safe',
        'border-t border-white/[0.07]',
        'bg-[#0A0A15]/90 backdrop-blur-2xl',
      )}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-col items-center justify-center flex-1 py-2 min-h-[52px] press-scale"
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Active background pill */}
            <AnimatePresence>
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute inset-x-1 top-1 bottom-1 rounded-2xl bg-indigo-500/15 border border-indigo-500/25"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </AnimatePresence>

            {/* Icon */}
            <motion.div
              animate={isActive ? { scale: 1.12, y: -1 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="relative z-10"
            >
              <Icon
                className={cn(
                  'w-5 h-5 transition-colors duration-200',
                  isActive ? 'text-indigo-400' : 'text-white/35',
                )}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {/* Live dot for active state */}
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-dot"
                  className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.div>

            {/* Label */}
            <span
              className={cn(
                'relative z-10 mt-0.5 text-[10px] font-medium transition-colors duration-200 leading-none',
                isActive ? 'text-indigo-300' : 'text-white/30',
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
