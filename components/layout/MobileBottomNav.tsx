'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  Brain,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Floating bottom dock — md:hidden. Pill glass bar with gold active glow.
 * Icon-forward: labels are screen-reader only for clarity across locales.
 */
const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'home' as const, icon: LayoutDashboard },
  { href: '/performance', labelKey: 'performance' as const, icon: BarChart3 },
  { href: '/creative', labelKey: 'creative' as const, icon: Clapperboard },
  { href: '/mono-ai', labelKey: 'mono' as const, icon: Brain },
  { href: '/chat', labelKey: 'chat' as const, icon: MessageSquare },
] as const;

const tapSpring = { type: 'spring' as const, stiffness: 520, damping: 28 };

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations('Dashboard.mobileNav');

  return (
    <nav
      className={cn(
        'md:hidden pointer-events-none fixed left-1/2 -translate-x-1/2 z-50',
        'w-[min(100%-1.25rem,420px)]',
      )}
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label={t('mainNavAria')}
    >
      <div
        className={cn(
          'pointer-events-auto flex items-center justify-between gap-0.5',
          'rounded-full border border-white/10',
          'bg-[#0c070c]/55 backdrop-blur-3xl',
          'shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]',
          'px-2 py-2',
        )}
        style={{
          WebkitBackdropFilter: 'blur(64px) saturate(200%)',
          backdropFilter: 'blur(64px) saturate(200%)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-1 flex-col items-center justify-center min-w-0 py-1.5 rounded-full press-scale"
              aria-current={isActive ? 'page' : undefined}
              aria-label={t(item.labelKey)}
            >
              <motion.div
                whileTap={{ scale: 0.95 }}
                transition={tapSpring}
                className="relative flex flex-col items-center gap-0.5"
              >
                {isActive ? (
                  <span className="absolute -inset-x-1 -inset-y-1 rounded-full bg-[#bea042]/12" />
                ) : null}
                <span
                  className={cn(
                    'relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200',
                    isActive ? 'text-[#bea042]' : 'text-white/40',
                  )}
                  style={
                    isActive
                      ? {
                          filter: 'drop-shadow(0 0 10px rgba(190, 160, 66, 0.85))',
                          boxShadow:
                            '0 0 20px rgba(190, 160, 66, 0.35), inset 0 0 12px rgba(190, 160, 66, 0.12)',
                        }
                      : undefined
                  }
                >
                  <Icon className="w-[1.25rem] h-[1.25rem]" strokeWidth={isActive ? 2.25 : 1.85} />
                </span>
                <span className="sr-only">{t(item.labelKey)}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
