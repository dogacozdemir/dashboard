'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { TenantLogoMark } from '@/components/branding/TenantLogoMark';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  MessageSquare,
  Brain,
  Globe,
  Shield,
  CalendarDays,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const LEFT_ITEMS = [
  { href: '/dashboard', labelKey: 'home' as const, icon: LayoutDashboard },
  { href: '/performance', labelKey: 'performance' as const, icon: BarChart3 },
] as const;

const RIGHT_ITEMS = [
  { href: '/creative', labelKey: 'creative' as const, icon: Clapperboard },
  { href: '/chat', labelKey: 'chat' as const, icon: MessageSquare },
] as const;

const STACK_ITEMS = [
  { href: '/mastery', labelKey: 'masteryHall' as const, icon: Trophy },
  { href: '/mono-ai', labelKey: 'monoAi' as const, icon: Brain },
  { href: '/strategy', labelKey: 'seoGeo' as const, icon: Globe },
  { href: '/brand-vault', labelKey: 'brandVault' as const, icon: Shield },
  { href: '/calendar', labelKey: 'opsCalendar' as const, icon: CalendarDays },
] as const;

const tapSpring = { type: 'spring' as const, stiffness: 520, damping: 28 };

interface MobileBottomNavProps {
  brandLogoUrl?: string | null;
}

export function MobileBottomNav({ brandLogoUrl }: MobileBottomNavProps) {
  const pathname = usePathname();
  const tMobile = useTranslations('Dashboard.mobileNav');
  const tSidebar = useTranslations('Dashboard.sidebar');
  const [armoryOpen, setArmoryOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const showHint = useMemo(() => {
    if (!isClient || hintDismissed) return false;
    try {
      return localStorage.getItem('madmonos.pwaArmoryHint.v1') !== '1';
    } catch {
      return false;
    }
  }, [isClient, hintDismissed]);

  const isArmoryActive = useMemo(
    () => STACK_ITEMS.some((item) => pathname === item.href || pathname.startsWith(item.href + '/')),
    [pathname],
  );

  return (
    <>
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-50 pointer-events-none"
        aria-label={tMobile('mainNavAria')}
      >
        <div className="pointer-events-none mx-auto w-full max-w-[420px] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div
            className={cn(
              'pointer-events-auto relative rounded-[2rem] border border-white/10 border-t border-white/10',
              'bg-white/5 backdrop-blur-3xl',
              'shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]',
              'px-3 pt-3 pb-2',
            )}
            style={{
              WebkitBackdropFilter: 'blur(64px) saturate(200%)',
              backdropFilter: 'blur(64px) saturate(200%)',
            }}
          >
            <div className="relative flex items-end justify-between gap-1">
              <div className="flex w-[40%] items-center justify-around">
                {LEFT_ITEMS.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative flex h-12 w-12 items-center justify-center rounded-full press-scale"
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={tMobile(item.labelKey)}
                    >
                      <AnimatePresence>
                        {isActive ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            className="absolute inset-0 rounded-full bg-[#bea042]/12"
                          />
                        ) : null}
                      </AnimatePresence>
                      <motion.span
                        whileTap={{ scale: 0.93 }}
                        transition={tapSpring}
                        className={cn('relative z-10', isActive ? 'text-[#bea042]' : 'text-white/45')}
                        style={isActive ? { filter: 'drop-shadow(0 0 10px rgba(190,160,66,0.85))' } : undefined}
                      >
                        <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.9} />
                      </motion.span>
                    </Link>
                  );
                })}
              </div>

              {/* Apex handle — Glass Gem */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.93 }}
                transition={tapSpring}
                onClick={() => {
                  setHintDismissed(true);
                  try {
                    localStorage.setItem('madmonos.pwaArmoryHint.v1', '1');
                  } catch {
                    // ignore storage failures
                  }
                  setArmoryOpen((prev) => !prev);
                }}
                aria-label="Open navigation stack"
                aria-expanded={armoryOpen}
                aria-controls="mobile-armory-stack"
                className="relative -mt-9 flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full text-white"
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: '0 0 32px rgba(190,160,66,0.35)' }}
                  aria-hidden
                />
                <span
                  className={cn(
                    'absolute inset-0 rounded-full border',
                    isArmoryActive || armoryOpen ? 'border-[#bea042]/65' : 'border-white/15',
                  )}
                  style={{
                    background:
                      'radial-gradient(120% 120% at 28% 20%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.0) 45%), linear-gradient(145deg, rgba(156,112,178,0.96) 0%, rgba(190,160,66,0.96) 100%)',
                  }}
                  aria-hidden
                />
                <motion.span
                  animate={{ rotate: armoryOpen ? 45 : 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="relative z-10"
                >
                  <TenantLogoMark
                    brandLogoUrl={brandLogoUrl}
                    alt="Navigation"
                    width={50}
                    height={50}
                    className="h-[50px] w-[50px]"
                    priority
                  />
                </motion.span>

                {/* One-time hint */}
                <AnimatePresence>
                  {showHint && !armoryOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        y: [8, 0, 0, 8],
                        scale: [0.98, 1, 1, 0.98],
                      }}
                      transition={{
                        duration: 3.6,
                        times: [0, 0.12, 0.82, 1],
                        ease: 'easeOut',
                      }}
                      onAnimationComplete={() => {
                        setHintDismissed(true);
                        try {
                          localStorage.setItem('madmonos.pwaArmoryHint.v1', '1');
                        } catch {
                          // ignore storage failures
                        }
                      }}
                      className="absolute bottom-[78px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-[#0c070c]/70 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
                      style={{ WebkitBackdropFilter: 'blur(24px) saturate(170%)' }}
                    >
                      More’da tüm sayfalar
                      <span className="absolute left-1/2 top-full -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-white/15 bg-[#0c070c]/70" />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.button>

              <div className="flex w-[40%] items-center justify-around">
                {RIGHT_ITEMS.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative flex h-12 w-12 items-center justify-center rounded-full press-scale"
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={tMobile(item.labelKey)}
                    >
                      <AnimatePresence>
                        {isActive ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            className="absolute inset-0 rounded-full bg-[#bea042]/12"
                          />
                        ) : null}
                      </AnimatePresence>
                      <motion.span
                        whileTap={{ scale: 0.93 }}
                        transition={tapSpring}
                        className={cn('relative z-10', isActive ? 'text-[#bea042]' : 'text-white/45')}
                        style={isActive ? { filter: 'drop-shadow(0 0 10px rgba(190,160,66,0.85))' } : undefined}
                      >
                        <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.9} />
                      </motion.span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {armoryOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-[60]"
          >
            <motion.button
              type="button"
              aria-label="Close navigation stack"
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
              onClick={() => setArmoryOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.div
              id="mobile-armory-stack"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation stack"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 700) setArmoryOpen(false);
              }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="absolute inset-x-0 bottom-[92px] flex justify-center px-4"
            >
              <div className="w-full max-w-[420px]">
                {/* Upward-extending Liquid Glass stack (Cephanelik) */}
                <div className="relative mx-auto w-full max-w-[340px]">
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 14 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className={cn(
                      'overflow-hidden rounded-[2.25rem] border border-white/20',
                      'bg-[#0c070c]/80 backdrop-blur-3xl',
                      'shadow-[0_-18px_55px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.10)]',
                    )}
                    style={{ WebkitBackdropFilter: 'blur(64px) saturate(180%)' }}
                  >
                    {/* Rim light + corner leaks */}
                    <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden>
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                      <div className="absolute -top-16 -left-10 h-40 w-40 rounded-full bg-purple-500/10 blur-2xl" />
                      <div className="absolute -bottom-14 -right-10 h-40 w-40 rounded-full bg-amber-400/10 blur-2xl" />
                    </div>

                    <div className="relative grid grid-cols-1 gap-2 p-3">
                      {STACK_ITEMS.map((item, idx) => {
                        // Stack order: Mono AI (top), SEO&GEO, Brand Vault, Ops Calendar (bottom/base).
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        const Icon = item.icon;
                        const baseDelay = 0.04;
                        return (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.98 }}
                            transition={{ type: 'spring', stiffness: 520, damping: 34, delay: idx * baseDelay }}
                          >
                            <Link
                              href={item.href}
                              onClick={() => setArmoryOpen(false)}
                              className={cn(
                                'relative flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all',
                                'backdrop-blur-3xl',
                                isActive
                                  ? 'border-[#bea042]/55 bg-[#bea042]/12 text-[#bea042]'
                                  : 'border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex h-9 w-9 items-center justify-center rounded-2xl border',
                                  isActive ? 'border-[#bea042]/45 bg-[#bea042]/12' : 'border-white/10 bg-white/[0.03]',
                                )}
                                style={isActive ? { boxShadow: '0 0 18px rgba(190,160,66,0.25)' } : undefined}
                              >
                                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight truncate">{tSidebar(item.labelKey)}</p>
                                <p className="text-[11px] text-white/40 leading-tight truncate">
                                  {item.href === '/mastery'
                                    ? tMobile('stackMastery')
                                    : item.href === '/mono-ai'
                                      ? 'Jungle Engine'
                                      : item.href === '/strategy'
                                        ? 'SEO & GEO cockpit'
                                        : item.href === '/brand-vault'
                                          ? 'Brand Mono assets'
                                          : 'Ops calendar'}
                                </p>
                              </div>
                              {isActive ? (
                                <span
                                  className="ml-auto h-2 w-2 rounded-full bg-[#bea042]"
                                  style={{ boxShadow: '0 0 14px rgba(190,160,66,0.75)' }}
                                />
                              ) : (
                                <span className="ml-auto h-2 w-2 rounded-full bg-white/10" />
                              )}
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
