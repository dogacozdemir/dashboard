'use client';

import Link from 'next/link';
import { TenantLogoMark } from '@/components/branding/TenantLogoMark';
import { motion } from 'framer-motion';
import { Search, Settings } from 'lucide-react';
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
import { useTranslations } from 'next-intl';
import { NotificationCenter } from '@/app/components/layout/NotificationCenter';
import type { SessionUser } from '@/types/user';
import type { LuxNotificationItem } from '@/features/notifications/types';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

interface TopBarProps {
  user: SessionUser;
  companyId: string;
  title: string;
  subtitle?: string;
  /** White-label mark for mobile header chip. */
  brandLogoUrl?: string | null;
  initialNotifs?: LuxNotificationItem[];
  canUseNotifications?: boolean;
}

export function TopBar({
  user,
  companyId,
  title,
  subtitle,
  brandLogoUrl,
  initialNotifs = [],
  canUseNotifications = false,
}: TopBarProps) {
  const t = useTranslations('Common.commandPalette');
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 1 }}
      className="gpu-heavy-blur-layer relative flex h-12 shrink-0 items-center gap-2 overflow-hidden rounded-2xl border border-white/[0.10] px-3 md:h-16 md:gap-3 md:px-6"
      style={{
        background: 'rgba(29, 15, 29, 0.4)',
        backdropFilter: 'var(--topbar-backdrop)',
        WebkitBackdropFilter: 'var(--topbar-backdrop)',
        boxShadow: '0 0 0 0.5px rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-white/18 to-transparent pointer-events-none" />

      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <Link href="/dashboard" className="md:hidden shrink-0 press-scale">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#9c70b2] to-[#bea042] shadow-lg shadow-[#9c70b2]/25 md:h-8 md:w-8">
            <TenantLogoMark
              brandLogoUrl={brandLogoUrl}
              alt="Brand"
              width={16}
              height={16}
              className="h-3.5 w-3.5 md:h-4 md:w-4"
              priority
            />
            <span className="pulse-ring absolute inset-0 rounded-xl" />
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-xs font-semibold leading-tight text-white/90 md:text-sm">
              {title}
            </h1>
            <div className="flex shrink-0 items-center gap-1 md:hidden">
              <LanguageSwitcher />
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => window.dispatchEvent(new CustomEvent('madmonos:command-open'))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/55 transition-colors hover:border-[#bea042]/25 hover:text-[#bea042]/90"
                aria-label={t('commandCenterAria')}
              >
                <Search className="h-3.5 w-3.5" />
              </motion.button>
              <NotificationCenter
                companyId={companyId}
                initialNotifs={initialNotifs}
                enabled={canUseNotifications}
              />
            </div>
          </div>
          {subtitle ? (
            <p className="mt-0.5 hidden truncate text-[11px] text-white/30 sm:block">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-1.5 md:flex md:gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => window.dispatchEvent(new CustomEvent('madmonos:command-open'))}
          className="press-scale flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs text-white/40 transition-all duration-200 hover:border-[#bea042]/25 hover:text-white/70"
          style={{ boxShadow: '0 0 10px rgba(190,160,66,0.06)' }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden whitespace-nowrap sm:inline">{t('searchPlaceholderDesktop')}</span>
          <kbd className="ml-1 hidden items-center rounded px-1.5 py-0.5 text-[10px] text-white/30 lg:inline-flex bg-white/[0.06]">
            ⌘K
          </kbd>
        </motion.button>

        <LanguageSwitcher />

        <NotificationCenter
          companyId={companyId}
          initialNotifs={initialNotifs}
          enabled={canUseNotifications}
        />

        <Link href="/profile" className="hidden sm:block">
          <button
            type="button"
            className="press-scale flex h-8 w-8 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-white/40 transition-all duration-200 hover:border-[#bea042]/20 hover:bg-white/[0.07] hover:text-[#bea042]/80"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="press-scale flex cursor-pointer items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-2 outline-none transition-colors hover:bg-white/[0.05] md:pr-3">
            <Avatar
              className="h-7 w-7 ring-2 ring-[#bea042]/20 md:h-7"
              style={{ boxShadow: '0 0 10px rgba(190,160,66,0.12)' }}
            >
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback className="bg-gradient-to-br from-[#9c70b2]/40 to-[#bea042]/30 text-xs font-semibold text-[#e3d0ea]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left md:block">
              <p className="text-xs font-medium leading-tight text-white/80">{user.name ?? user.email}</p>
              <Badge
                variant="secondary"
                className="mt-0.5 h-4 border-[#bea042]/25 bg-[#bea042]/12 px-1.5 text-[9px] capitalize text-[#bea042]"
              >
                {user.role}
              </Badge>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-52 border-white/[0.08] bg-[#130c13]/95 text-white/80 backdrop-blur-2xl"
          >
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-white/70">{user.name}</p>
              <p className="mt-0.5 text-[11px] text-white/35">{user.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem className="cursor-pointer p-0 hover:bg-white/[0.06]">
              <Link href="/profile" className="block w-full px-3 py-2 text-sm">
                {t('profileSettings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              className="cursor-pointer px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              {t('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex shrink-0 md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger className="press-scale flex cursor-pointer items-center rounded-2xl py-1 outline-none">
            <Avatar className="h-7 w-7 ring-2 ring-[#bea042]/20" style={{ boxShadow: '0 0 10px rgba(190,160,66,0.12)' }}>
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback className="bg-gradient-to-br from-[#9c70b2]/40 to-[#bea042]/30 text-[10px] font-semibold text-[#e3d0ea]">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 border-white/[0.08] bg-[#130c13]/95 text-white/80 backdrop-blur-2xl"
          >
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-white/70">{user.name}</p>
              <p className="mt-0.5 text-[11px] text-white/35">{user.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem className="cursor-pointer p-0 hover:bg-white/[0.06]">
              <Link href="/profile" className="block w-full px-3 py-2 text-sm">
                {t('profileSettings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              className="cursor-pointer px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              {t('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}
