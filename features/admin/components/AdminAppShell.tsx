'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones,
  LayoutDashboard,
  Globe,
  ListTodo,
  Settings,
  Shield,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const ADMIN_NAV = [
  { href: '/', labelKey: 'controlCenter' as const, icon: Sparkles },
  { href: '/to-do', labelKey: 'opsCenter' as const, icon: ListTodo },
  { href: '/support-hub', labelKey: 'supportCenter' as const, icon: Headphones },
  { href: '/tenants', labelKey: 'tenants' as const, icon: LayoutDashboard },
  { href: '/users', labelKey: 'users' as const, icon: Users },
  { href: '/roles', labelKey: 'roleArchitect' as const, icon: Shield },
  { href: '/subdomains', labelKey: 'subdomains' as const, icon: Globe },
  { href: '/uploads', labelKey: 'uploads' as const, icon: Upload },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  children: React.ReactNode;
  userEmail: string | null;
};

export function AdminAppShell({ children, userEmail }: Props) {
  const pathname = usePathname();
  const t = useTranslations('Admin');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--surface-deep)]">
      {/* Aurora — same language as DashboardShell */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="aurora-orb-1 absolute -top-60 -left-40 w-[700px] h-[700px] rounded-full bg-purple-600/[0.08] blur-[130px]" />
        <div className="aurora-orb-2 absolute -bottom-56 -right-32 w-[600px] h-[600px] rounded-full bg-amber-700/[0.08] blur-[140px]" />
        <div className="aurora-orb-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-purple-900/[0.05] blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Sidebar — floating glass, tenant Sidebar composition */}
        <div className="hidden shrink-0 md:flex md:p-4">
          <motion.aside
            animate={{ width: collapsed ? 72 : 264 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 1 }}
            className="gpu-heavy-blur-layer relative flex h-full max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl border border-white/[0.10]"
            style={{
              background: 'rgba(29, 15, 29, 0.45)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              boxShadow:
                '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[#1d0f1d]/20" />
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative z-10 flex items-center gap-3 border-b border-white/[0.07] px-4 h-16">
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 p-2 shadow-lg shadow-orange-500/20"
                aria-label={collapsed ? 'Expand admin menu' : 'Collapse admin menu'}
              >
                <Image
                  src="/madmonos-logo-optimized.png"
                  alt="Madmonos logo"
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                  priority
                />
              </button>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="min-w-0 overflow-hidden"
                  >
                    <span className="block truncate text-sm font-bold tracking-tight gradient-text-indigo">
                      {t('sidebarTitle')}
                    </span>
                    <p className="truncate text-[10px] uppercase tracking-widest text-white/30">{t('sidebarSubtitle')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <nav className="relative z-10 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-4 scrollbar-thin">
              {ADMIN_NAV.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="block min-w-0">
                    <motion.div
                      className={cn(
                        'relative flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5',
                        active ? 'text-[#e3d0ea]' : 'text-white/35 hover:text-white/75',
                      )}
                      whileHover={{ x: collapsed ? 0 : 3 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    >
                      {active && (
                        <motion.div
                          layoutId="admin-sidebar-active"
                          className="absolute inset-0 rounded-2xl"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(156,112,178,0.22) 0%, rgba(190,160,66,0.12) 100%)',
                            border: '1px solid rgba(190,160,66,0.28)',
                            boxShadow:
                              '0 0 24px rgba(156,112,178,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
                          }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 1 }}
                        />
                      )}
                      {!active && (
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#9c70b2]/0 to-[#bea042]/0 opacity-0 transition-opacity hover:from-[#9c70b2]/12 hover:to-[#bea042]/6 hover:opacity-100" />
                      )}
                      <Icon className="relative z-10 h-4 w-4 shrink-0" strokeWidth={1.75} />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="relative z-10 truncate text-sm"
                          >
                            {t(`nav.${item.labelKey}`)}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </Link>
                );
              })}
            </nav>

            <div className="relative z-10 border-t border-white/[0.07] px-4 py-4">
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="min-w-0"
                  >
                    <p className="truncate text-[10px] text-white/25">{userEmail}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-red-400/60">{t('footerAccess')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.aside>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile nav */}
          <div className="shrink-0 border-b border-white/[0.08] bg-[var(--surface-elevated)]/80 backdrop-blur-xl md:hidden">
            <div className="flex items-center gap-2 overflow-x-auto px-3 py-3 scrollbar-thin">
              {ADMIN_NAV.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                      active
                        ? 'bg-white/[0.12] text-white/90 ring-1 ring-white/15'
                        : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {t(`nav.${item.labelKey}`)}
                  </Link>
                );
              })}
            </div>
          </div>
          <motion.header
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="gpu-heavy-blur-layer relative z-[1] mx-3 mt-3 flex h-14 shrink-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/[0.10] px-4 md:mx-4 md:mt-4 md:h-16 md:px-6"
            style={{
              background: 'rgba(29, 15, 29, 0.4)',
              backdropFilter: 'var(--topbar-backdrop)',
              WebkitBackdropFilter: 'var(--topbar-backdrop)',
              boxShadow: '0 0 0 0.5px rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-white/18 to-transparent" />
            <p className="relative min-w-0 truncate text-xs text-white/30">
              <span className="text-red-400/70">● {t('headerLive')}</span>
              &nbsp;·&nbsp;{t('headerTitle')}
            </p>
            <Link
              href="/settings"
              className="relative flex shrink-0 items-center gap-2 text-xs text-white/30 transition-colors hover:text-white/60"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('platformSettings')}</span>
            </Link>
          </motion.header>

          <main className="dashboard-scroll-region relative z-[1] flex-1 overflow-y-auto px-4 py-6 scrollbar-thin md:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
