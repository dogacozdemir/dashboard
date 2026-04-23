'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  Globe,
  Shield,
  ChevronLeft,
  ChevronRight,
  Zap,
  MessageSquare,
  CalendarDays,
  Brain,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Tenant } from '@/types/tenant';
import type { UserGamificationData } from '@/features/gamification/types';
import { XPProgress } from '@/features/gamification/components/XPProgress';
import { StreakCounter } from '@/features/gamification/components/StreakCounter';

interface NavItem {
  href:   string;
  label:  string;
  icon:   React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: string;
  color?: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard',   label: 'Overview',        icon: LayoutDashboard },
  { href: '/performance', label: 'Performance Hub',  icon: BarChart3,      badge: 'Live',  color: 'cyan' },
  { href: '/creative',    label: 'Creative Studio',  icon: Clapperboard,                   color: 'violet' },
  { href: '/strategy',    label: 'SEO & GEO',        icon: Globe,                          color: 'emerald' },
  { href: '/brand-vault', label: 'Brand Vault',       icon: Shield },
  { href: '/chat',        label: 'Chat',              icon: MessageSquare },
  { href: '/mono-ai',     label: 'Mono AI',           icon: Brain,          badge: 'AI',   color: 'indigo' },
  { href: '/calendar',    label: 'Ops Calendar',      icon: CalendarDays },
];

interface SidebarProps {
  tenant:         Tenant;
  gamification?:  UserGamificationData | null;
}

export function Sidebar({ tenant, gamification }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 244 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-screen border-r border-white/[0.06] bg-[#0B0B16] shrink-0 overflow-hidden"
    >
      {/* Top gradient shine */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06]">
        {/* Logo mark with pulse ring */}
        <div className="relative shrink-0">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-400 to-cyan-500 shadow-lg shadow-indigo-500/30"
          >
            <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </motion.div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-[#0B0B16] animate-float-slow" />
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <span className="font-bold text-sm tracking-tight gradient-text-indigo whitespace-nowrap">
                madmonos
              </span>
              <p className="text-[10px] text-white/25 uppercase tracking-widest whitespace-nowrap mt-0.5">
                AI-First Agency
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Tenant badge ── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mx-3 mt-3 px-3 py-2.5 rounded-xl gradient-border bg-white/[0.025]"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-indigo-400/60 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-white/25 uppercase tracking-widest leading-none mb-0.5">Brand</p>
                <p className="text-xs font-semibold text-white/80 truncate">{tenant.name}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item, idx) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group cursor-pointer',
                  isActive
                    ? 'text-indigo-300'
                    : 'text-white/35 hover:text-white/75 hover:bg-white/[0.04]',
                )}
                whileHover={{ x: collapsed ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.13 }}
                style={{ transitionDelay: `${idx * 12}ms` }}
              >
                {/* Active pill — animated via layoutId */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(6,182,212,0.08) 100%)',
                      border:     '1px solid rgba(99,102,241,0.28)',
                      boxShadow:  'inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
                  />
                )}

                {/* Icon */}
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 relative z-10 transition-colors duration-200',
                    isActive ? 'text-indigo-400' : 'group-hover:text-white/70',
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />

                {/* Label */}
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="relative z-10 text-sm font-medium whitespace-nowrap flex-1 leading-none"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Badge */}
                {!collapsed && item.badge && (
                  <span
                    className={cn(
                      'relative z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0',
                      item.badge === 'Live'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                        : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* ── Gamification HUD ── */}
      <AnimatePresence>
        {gamification && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="mx-3 mb-2 space-y-2"
          >
            <StreakCounter streak={gamification.streak} compact />
            <XPProgress totalXP={gamification.totalXP} level={gamification.level} compact />
          </motion.div>
        )}
        {gamification && collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-1 mb-2"
          >
            <span className="text-base">
              {gamification.streak.currentStreak >= 7 ? '🔥' : gamification.streak.currentStreak >= 3 ? '🔥' : '✨'}
            </span>
            <span className="text-[9px] font-bold text-white/30 tabular-nums">
              {gamification.streak.currentStreak}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Collapse toggle ── */}
      <div className="border-t border-white/[0.05] px-2 py-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCollapsed((prev) => !prev)}
          className={cn(
            'flex items-center justify-center rounded-xl h-9 bg-white/[0.03] border border-white/[0.06]',
            'text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-colors',
            collapsed ? 'w-full' : 'w-full',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-xs">Collapse</span>
            </motion.div>
          )}
        </motion.button>
      </div>
    </motion.aside>
  );
}
