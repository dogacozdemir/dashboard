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
  MessageSquare,
  Brain,
  CalendarDays,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Tenant } from '@/types/tenant';

const navItems = [
  { href: '/dashboard',   label: 'Overview',        icon: LayoutDashboard },
  { href: '/performance', label: 'Performance Hub',  icon: BarChart3 },
  { href: '/creative',    label: 'Creative Studio',  icon: Clapperboard },
  { href: '/strategy',    label: 'SEO & GEO',   icon: Globe },
  { href: '/brand-vault', label: 'Brand Vault',      icon: Shield },
  { href: '/chat',        label: 'Chat',             icon: MessageSquare },
  { href: '/mono-ai',     label: 'Mono AI',          icon: Brain },
  { href: '/calendar',    label: 'Ops Calendar',     icon: CalendarDays },
];

interface MobileSidebarProps {
  tenant: Tenant;
}

export function MobileSidebar({ tenant }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Hamburger trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-colors"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col bg-[#0F0F1A] border-r border-white/[0.06] shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 shrink-0">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-sm gradient-text-indigo">madmonos</span>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">AI-First Agency</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tenant badge */}
              <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Brand</p>
                <p className="text-xs font-medium text-white/80">{tenant.name}</p>
              </div>

              {/* Nav */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                    >
                      <div
                        className={cn(
                          'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                          isActive
                            ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                            : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                        )}
                      >
                        <Icon className={cn('w-4 h-4 shrink-0', isActive && 'text-indigo-400')} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
