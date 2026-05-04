'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { ImpersonationBanner } from './ImpersonationBanner';
import { DemoShowroomBanner } from './DemoShowroomBanner';
import type { Tenant } from '@/types/tenant';
import type { SessionUser } from '@/types/user';
import type { UserGamificationData } from '@/features/gamification/types';
import { CelebrationOverlay } from '@/features/gamification/components/CelebrationOverlay';
import type { LuxNotificationItem } from '@/features/notifications/types';
import { CommandCenter } from '@/app/components/layout/CommandCenter';
import {
  MADMONOS_SPRING,
  madmonosLiquidPageVariants,
  madmonosReducedPageVariants,
  madmonosReducedTransition,
} from '@/lib/motion/madmonos-motion';

interface DashboardShellProps {
  tenant:          Tenant;
  user:            SessionUser;
  title:           string;
  subtitle?:       string;
  initialNotifs?:  LuxNotificationItem[];
  gamification?:   UserGamificationData | null;
  /** Super-admin customer view (impersonation cookie). */
  impersonation?:  { tenantName: string; exitHref: string } | null;
  /** Showroom tenant — simulated analytics & gamification. */
  showroomMode?: boolean;
  canManageTeam?:  boolean;
  canUseNotifications?: boolean;
  children:        React.ReactNode;
}

export function DashboardShell({
  tenant,
  user,
  title,
  subtitle,
  initialNotifs = [],
  gamification,
  impersonation = null,
  showroomMode = false,
  canManageTeam = false,
  canUseNotifications = false,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const mainScrollRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const pageVariants = reduce ? madmonosReducedPageVariants : madmonosLiquidPageVariants;
  const pageTransition = reduce ? madmonosReducedTransition : MADMONOS_SPRING;

  useLayoutEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
    if (!reduce) {
      el.style.willChange = 'transform, opacity, filter';
    }
    const clear = () => {
      if (mainScrollRef.current === el) {
        el.style.willChange = 'auto';
      }
    };
    const t = window.setTimeout(clear, 520);
    return () => {
      window.clearTimeout(t);
      clear();
    };
  }, [pathname, reduce]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#0c070c]">

      {/* ── Aurora background — light sources inside the void ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        {/* Amethyst light source — top-left */}
        <div className="aurora-orb-1 absolute -top-60 -left-40 w-[700px] h-[700px] rounded-full bg-purple-600/[0.08] blur-[130px]" />
        {/* Gold light source — bottom-right */}
        <div className="aurora-orb-2 absolute -bottom-56 -right-32 w-[600px] h-[600px] rounded-full bg-amber-700/[0.08] blur-[140px]" />
        {/* Soft center bloom */}
        <div className="aurora-orb-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-purple-900/[0.05] blur-[120px]" />
      </div>

      {/* ── Celebration overlay (confetti + achievement toasts) ── */}
      <CelebrationOverlay />

      {/* ── Desktop sidebar — floats with padding ── */}
      <div className="relative z-10 hidden md:flex p-4">
        <Sidebar tenant={tenant} gamification={gamification} canManageTeam={canManageTeam} />
      </div>

      {/* ── Main column ── */}
      <div
        className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden px-safe pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
      >
        <TopBar
          user={user}
          companyId={tenant.id}
          title={title}
          subtitle={subtitle}
          brandLogoUrl={tenant.brand_logo_url ?? null}
          initialNotifs={initialNotifs}
          canUseNotifications={canUseNotifications}
        />

        {impersonation && (
          <ImpersonationBanner tenantName={impersonation.tenantName} exitHref={impersonation.exitHref} />
        )}

        {showroomMode ? <DemoShowroomBanner /> : null}

        {/* Stable clip rect + positioning root for popLayout (exiting route is absolute). */}
        <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.main
              ref={mainScrollRef}
              key={pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="dashboard-scroll-region mm-page-motion-will-change relative z-[1] min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 py-4 md:px-6 md:py-4 pb-mobile-dock md:pb-6"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile bottom navigation (hidden on md+) ── */}
      <MobileBottomNav brandLogoUrl={tenant.brand_logo_url ?? null} />

      <CommandCenter
        companyId={tenant.id}
        user={user}
        totalXP={gamification?.totalXP ?? null}
        level={gamification?.level.level ?? null}
      />
    </div>
  );
}
