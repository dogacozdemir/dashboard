'use client';

import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { ImpersonationBanner } from './ImpersonationBanner';
import { DemoShowroomBanner } from './DemoShowroomBanner';
import type { Tenant } from '@/types/tenant';
import type { SessionUser } from '@/types/user';
import { CelebrationOverlay } from '@/features/gamification/components/CelebrationOverlay';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import {
  MADMONOS_SPRING,
  madmonosLiquidPageVariants,
  madmonosReducedPageVariants,
  madmonosReducedTransition,
} from '@/lib/motion/madmonos-motion';

interface DashboardShellProps {
  tenant: Tenant;
  user: SessionUser;
  title: string;
  subtitle?: string;
  sidebarSlot: ReactNode;
  notificationSlot: ReactNode;
  commandCenterSlot: ReactNode;
  /** Super-admin customer view (impersonation cookie). */
  impersonation?: { tenantName: string; exitHref: string } | null;
  /** Showroom tenant — simulated analytics & gamification. */
  showroomMode?: boolean;
  canManageTeam?: boolean;
  children: ReactNode;
}

export function DashboardShell({
  tenant,
  user,
  title,
  subtitle,
  sidebarSlot,
  notificationSlot,
  commandCenterSlot,
  impersonation = null,
  showroomMode = false,
  canManageTeam = false,
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
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="aurora-orb-1 absolute -top-60 -left-40 w-[700px] h-[700px] rounded-full bg-purple-600/[0.08] blur-[130px]" />
        <div className="aurora-orb-2 absolute -bottom-56 -right-32 w-[600px] h-[600px] rounded-full bg-amber-700/[0.08] blur-[140px]" />
        <div className="aurora-orb-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-purple-900/[0.05] blur-[120px]" />
      </div>

      <CelebrationOverlay />

      <div className="relative z-10 hidden md:flex p-4">{sidebarSlot}</div>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden px-safe pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <TopBar
          user={user}
          title={title}
          subtitle={subtitle}
          brandLogoUrl={tenant.brand_logo_url ?? null}
          notificationSlot={notificationSlot}
        />

        {impersonation && (
          <ImpersonationBanner tenantName={impersonation.tenantName} exitHref={impersonation.exitHref} />
        )}

        {showroomMode ? <DemoShowroomBanner /> : null}

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

      <MobileBottomNav brandLogoUrl={tenant.brand_logo_url ?? null} canManageTeam={canManageTeam} />

      <InstallPrompt />

      {commandCenterSlot}
    </div>
  );
}
