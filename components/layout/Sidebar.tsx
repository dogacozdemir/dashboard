'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TenantLogoMark } from '@/components/branding/TenantLogoMark';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  Globe,
  Shield,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  CalendarDays,
  Brain,
  Sparkles,
  Trophy,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Tenant } from '@/types/tenant';
import type { UserGamificationData } from '@/features/gamification/types';
import { XPProgress } from '@/features/gamification/components/XPProgress';
import { StreakCounter } from '@/features/gamification/components/StreakCounter';

interface NavItem {
  href: string;
  labelKey:
    | 'overview'
    | 'performanceHub'
    | 'creativeStudio'
    | 'seoGeo'
    | 'brandVault'
    | 'chat'
    | 'monoAi'
    | 'masteryHall'
    | 'opsCalendar';
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badgeKey?: 'badgeLive' | 'badgeAi';
  color?: string;
}

const NAV_DEF: NavItem[] = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/mastery', labelKey: 'masteryHall', icon: Trophy, color: 'amber' },
  {
    href: '/performance',
    labelKey: 'performanceHub',
    icon: BarChart3,
    badgeKey: 'badgeLive',
    color: 'cyan',
  },
  { href: '/creative', labelKey: 'creativeStudio', icon: Clapperboard, color: 'violet' },
  { href: '/strategy', labelKey: 'seoGeo', icon: Globe, color: 'emerald' },
  { href: '/brand-vault', labelKey: 'brandVault', icon: Shield },
  { href: '/chat', labelKey: 'chat', icon: MessageSquare },
  {
    href: '/mono-ai',
    labelKey: 'monoAi',
    icon: Brain,
    badgeKey: 'badgeAi',
    color: 'indigo',
  },
  { href: '/calendar', labelKey: 'opsCalendar', icon: CalendarDays },
];

interface SidebarProps {
  tenant:          Tenant;
  gamification?:   UserGamificationData | null;
  canManageTeam?: boolean;
}

export function Sidebar({ tenant, gamification, canManageTeam = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('Dashboard.sidebar');

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 264 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 1 }}
      className="gpu-heavy-blur-layer relative flex flex-col h-full rounded-3xl border border-white/[0.10] shrink-0 overflow-hidden"
      style={{
        background: 'rgba(29, 15, 29, 0.45)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        boxShadow: '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 20px 60px rgba(0,0,0,0.4)',
      }}
    >
      {/* Purple tint overlay */}
      <div className="absolute inset-0 rounded-3xl bg-[#1d0f1d]/20 pointer-events-none" />

      {/* Top rim light — specular highlight */}
      <div className="absolute top-0 left-0 right-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.07] relative z-10">
        {/* Logo mark with pulse ring */}
        <div className="relative shrink-0">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-[#9c70b2] via-[#b48dc8] to-[#bea042] shadow-lg shadow-[#9c70b2]/30"
          >
            <TenantLogoMark
              brandLogoUrl={tenant.brand_logo_url}
              alt={tenant.name ? `${tenant.name} logo` : 'Brand logo'}
              width={22}
              height={22}
              className="h-5.5 w-5.5"
              priority
            />
          </motion.div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#bea042] border-2 border-[#0e080e] animate-float-slow" />
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
                {tenant.brand_logo_url?.trim() ? tenant.name : 'madmonos'}
              </span>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mt-0.5 truncate">
                {t('tagline')}
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
            className="relative z-10 mx-3 mt-3 px-3 py-2.5 rounded-xl gradient-border bg-white/[0.025]"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-indigo-400/60 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-white/25 uppercase tracking-widest leading-none mb-0.5">{t('brandLabel')}</p>
                <p className="text-xs font-semibold text-white/80 truncate">{tenant.name}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav ── */}
      <nav className="relative z-10 flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_DEF.map((item, idx) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={cn(
                  'relative flex min-w-0 items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors group cursor-pointer',
                  isActive
                    ? 'text-[#e3d0ea]'
                    : 'text-white/35 hover:text-white/75',
                )}
                whileHover={{ x: collapsed ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                style={{ transitionDelay: `${idx * 8}ms` }}
              >
                {/* Active pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(156,112,178,0.22) 0%, rgba(190,160,66,0.12) 100%)',
                      border:     '1px solid rgba(190,160,66,0.28)',
                      boxShadow:  '0 0 24px rgba(156,112,178,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
                    }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 1 }}
                  />
                )}

                {/* Hover pill — gradient glow */}
                <div className={cn(
                  'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                  !isActive && 'bg-gradient-to-r from-[#9c70b2]/15 to-[#bea042]/8',
                )} />

                {/* Icon wrapper with breathing glow-dot */}
                <div className="relative shrink-0 z-10">
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors duration-200',
                      isActive ? 'text-[#bea042]' : 'group-hover:text-white/70',
                    )}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {isActive && (
                    <motion.span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-[#9c70b2]"
                      style={{ boxShadow: '0 0 8px rgba(156,112,178,0.9)' }}
                      animate={{ opacity: [0.5, 1, 0.5], scale: [0.85, 1.2, 0.85] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>

                {/* Label */}
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="relative z-10 text-sm font-medium min-w-0 flex-1 leading-tight text-left truncate"
                    >
                      {t(item.labelKey)}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Badge */}
                {!collapsed && item.badgeKey && (
                  <span
                    className={cn(
                      'relative z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0',
                      item.badgeKey === 'badgeLive'
                        ? 'bg-[#bea042]/15 text-[#bea042] border border-[#bea042]/30'
                        : 'bg-[#9c70b2]/15 text-[#b48dc8] border border-[#9c70b2]/30',
                    )}
                  >
                    {t(item.badgeKey)}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {canManageTeam && (
        <div className="relative z-10 px-2 pb-2 space-y-1">
          {!collapsed && (
            <p className="px-3 text-[9px] font-semibold text-white/22 uppercase tracking-[0.14em]">
              {t('workspace')}
            </p>
          )}
          <Link href="/settings/team">
            <motion.div
              className={cn(
                'relative flex min-w-0 items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors group cursor-pointer',
                pathname.startsWith('/settings')
                  ? 'text-[#e3d0ea]'
                  : 'text-white/35 hover:text-white/75',
              )}
              whileHover={{ x: collapsed ? 0 : 3 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            >
              {pathname.startsWith('/settings') && (
                <motion.div
                  layoutId="sidebar-active-settings"
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(156,112,178,0.18) 0%, rgba(190,160,66,0.1) 100%)',
                    border: '1px solid rgba(190,160,66,0.22)',
                  }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 1 }}
                />
              )}
              <UsersRound
                className={cn(
                  'relative z-10 w-4 h-4 shrink-0',
                  pathname.startsWith('/settings') ? 'text-[#bea042]' : 'group-hover:text-white/70',
                )}
                strokeWidth={pathname.startsWith('/settings') ? 2.2 : 1.8}
              />
              {!collapsed && (
                <span className="relative z-10 text-sm font-medium truncate min-w-0">{t('team')}</span>
              )}
            </motion.div>
          </Link>
        </div>
      )}

      {/* ── Gamification HUD ── */}
      <AnimatePresence>
        {gamification && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 mx-3 mb-2 space-y-2"
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
      <div className="relative z-10 border-t border-white/[0.07] px-2 py-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCollapsed((prev) => !prev)}
          className={cn(
            'flex items-center justify-center rounded-2xl h-9 bg-white/[0.04] border border-white/[0.07]',
            'text-white/30 hover:text-[#bea042]/70 hover:bg-white/[0.07] transition-colors',
            collapsed ? 'w-full' : 'w-full',
          )}
          title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
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
              <span className="text-xs truncate">{t('collapse')}</span>
            </motion.div>
          )}
        </motion.button>
      </div>
    </motion.aside>
  );
}
