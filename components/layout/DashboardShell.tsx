'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import type { Tenant } from '@/types/tenant';
import type { SessionUser } from '@/types/user';
import type { UserGamificationData } from '@/features/gamification/types';
import { CelebrationOverlay } from '@/features/gamification/components/CelebrationOverlay';

interface NotifItem {
  id: string;
  message: string;
  type: 'message' | 'alert' | 'approval' | 'system';
  senderName: string;
  isRead: boolean;
  createdAt: string;
}

interface DashboardShellProps {
  tenant:          Tenant;
  user:            SessionUser;
  title:           string;
  subtitle?:       string;
  initialNotifs?:  NotifItem[];
  gamification?:   UserGamificationData | null;
  children:        React.ReactNode;
}

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
};

export function DashboardShell({
  tenant,
  user,
  title,
  subtitle,
  initialNotifs = [],
  gamification,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#07070E]">

      {/* ── Aurora background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="aurora-orb-1 absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-indigo-600/[0.07] blur-[100px]" />
        <div className="aurora-orb-2 absolute -bottom-48 -right-24 w-[480px] h-[480px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
        <div className="aurora-orb-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-violet-600/[0.05] blur-[90px]" />
      </div>

      {/* ── Celebration overlay (confetti + achievement toasts) ── */}
      <CelebrationOverlay />

      {/* ── Desktop sidebar ── */}
      <div className="relative z-10 hidden md:flex">
        <Sidebar tenant={tenant} gamification={gamification} />
      </div>

      {/* ── Main column ── */}
      <div className="relative z-10 flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          user={user}
          companyId={tenant.id}
          title={title}
          subtitle={subtitle}
          initialNotifs={initialNotifs}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            /* pb-20 md:pb-6: leave space for the mobile bottom nav */
            className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* ── Mobile bottom navigation (hidden on md+) ── */}
      <MobileBottomNav />
    </div>
  );
}
