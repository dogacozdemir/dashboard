'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Settings, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { signOut } from 'next-auth/react';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import type { SessionUser } from '@/types/user';

interface NotifItem {
  id: string;
  message: string;
  type: 'message' | 'alert' | 'approval' | 'system';
  senderName: string;
  isRead: boolean;
  createdAt: string;
}

interface TopBarProps {
  user: SessionUser;
  companyId: string;
  title: string;
  subtitle?: string;
  /** @deprecated hamburger removed — mobile now uses MobileBottomNav */
  mobileSidebar?: React.ReactNode;
  initialNotifs?: NotifItem[];
}

export function TopBar({
  user,
  companyId,
  title,
  subtitle,
  initialNotifs = [],
}: TopBarProps) {
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="flex items-center justify-between px-4 md:px-6 h-14 md:h-16 border-b border-white/[0.06] bg-[#07070E]/85 backdrop-blur-xl shrink-0 gap-3"
    >
      {/* ── Left: mobile logo + page title ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Madmonos logo mark — visible on mobile only (no sidebar) */}
        <Link href="/dashboard" className="md:hidden shrink-0">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/25">
            <Zap className="w-4 h-4 text-white" />
            <span className="pulse-ring absolute inset-0 rounded-xl" />
          </div>
        </Link>

        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-white/90 truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-white/30 mt-0.5 hidden sm:block truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* ── Right: actions ── */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">

        {/* Search */}
        <button className="flex items-center gap-2 px-2.5 md:px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-all duration-200 text-xs press-scale">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Search...</span>
          <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-white/30 ml-1">⌘K</kbd>
        </button>

        {/* Notifications */}
        <NotificationBell companyId={companyId} initialNotifs={initialNotifs} />

        {/* Settings (hidden on smallest screens — accessible via profile) */}
        <Link href="/profile" className="hidden sm:block">
          <button className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-all duration-200 press-scale">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </Link>

        {/* Avatar + dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 pl-1.5 pr-2 md:pr-3 py-1.5 rounded-xl hover:bg-white/[0.05] transition-colors outline-none cursor-pointer press-scale">
            <Avatar className="w-7 h-7 ring-2 ring-indigo-500/20">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500/40 to-cyan-500/30 text-indigo-200 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-xs font-medium text-white/80 leading-tight">
                {user.name ?? user.email}
              </p>
              <Badge
                variant="secondary"
                className="text-[9px] h-4 px-1.5 mt-0.5 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 capitalize"
              >
                {user.role}
              </Badge>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-52 bg-[#161625]/95 backdrop-blur-xl border-white/[0.08] text-white/80"
          >
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-white/70">{user.name}</p>
              <p className="text-[11px] text-white/35 mt-0.5">{user.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem className="hover:bg-white/[0.06] cursor-pointer p-0">
              <Link href="/profile" className="w-full px-3 py-2 block text-sm">
                Profile & Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              className="text-rose-400 hover:bg-rose-500/10 cursor-pointer px-3 py-2 text-sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}
