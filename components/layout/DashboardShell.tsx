'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
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
import { useMediaQuery } from '@/hooks/useMediaQuery';

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

const pageTransition = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 26,
  mass: 1,
};

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
  const mobileNav = useMediaQuery('(max-width: 767px)');
  const pageVariants = mobileNav
    ? {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -16 },
      }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      };

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
        className="relative z-10 flex min-w-0 flex-1 flex-col gap-2 overflow-hidden px-safe pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
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

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="dashboard-scroll-region flex-1 overflow-y-auto scrollbar-thin px-4 py-4 md:px-6 md:py-4 pb-mobile-dock md:pb-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
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
