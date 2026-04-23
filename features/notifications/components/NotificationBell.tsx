'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MessageSquare, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ensureRealtimeAuth } from '@/lib/supabase/realtime';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface NotifItem {
  id: string;
  message: string;
  type: 'message' | 'alert' | 'approval' | 'system';
  senderName: string;
  isRead: boolean;
  createdAt: string;
}

const typeConfig = {
  message:  { icon: MessageSquare, color: 'text-indigo-400', href: '/chat' },
  alert:    { icon: AlertCircle,   color: 'text-amber-400',  href: '/performance' },
  approval: { icon: CheckCircle2,  color: 'text-emerald-400',href: '/creative' },
  system:   { icon: Bell,          color: 'text-white/40',   href: '/dashboard' },
};

interface NotificationBellProps {
  companyId: string;
  initialNotifs: NotifItem[];
}

export function NotificationBell({ companyId, initialNotifs }: NotificationBellProps) {
  const [notifs,  setNotifs]  = useState<NotifItem[]>(initialNotifs);
  const [open,    setOpen]    = useState(false);
  const [isLive,  setIsLive]  = useState(false);
  const router = useRouter();

  const unread = notifs.filter((n) => !n.isRead).length;

  // Supabase Realtime
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const connect = async () => {
      try {
        await ensureRealtimeAuth();
      } catch {
        if (isMounted) setIsLive(false);
      }
      if (!isMounted) return;

      channel = supabase
        .channel(`notif-bell:${companyId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${companyId}` },
          (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
            const row = payload.new as Record<string, unknown>;
            setNotifs((prev) => [{
              id:         row.id as string,
              message:    row.message as string,
              type:       row.type as NotifItem['type'],
              senderName: row.sender_name as string,
              isRead:     false,
              createdAt:  row.created_at as string,
            }, ...prev].slice(0, 20));
          }
        )
        .subscribe((status: string) => {
          if (!isMounted) return;
          setIsLive(status === 'SUBSCRIBED');
        });
    };
    void connect();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [companyId]);

  function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  }

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  function handleClick(notif: NotifItem) {
    markRead(notif.id);
    setOpen(false);
    const cfg = typeConfig[notif.type] ?? typeConfig.system;
    router.push(cfg.href);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center px-1"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 z-50 bg-[#161625] border border-white/[0.08] rounded-2xl shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/80">Notifications</span>
                  {unread > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                      {unread} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                    <Bell className="w-7 h-7 text-white/10" />
                    <p className="text-xs text-white/30">No notifications yet</p>
                  </div>
                ) : (
                  notifs.map((n) => {
                    const { icon: Icon, color } = typeConfig[n.type] ?? typeConfig.system;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]',
                          !n.isRead && 'bg-indigo-500/[0.04]'
                        )}
                      >
                        <div className={cn('w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0 mt-0.5', color)}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 leading-snug line-clamp-2">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/25">{n.senderName}</span>
                            <span className="text-[10px] text-white/20">·</span>
                            <span className="text-[10px] text-white/25">{formatRelativeTime(n.createdAt)}</span>
                          </div>
                        </div>
                        {!n.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-2" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-white/[0.06]">
                <button
                  onClick={() => { setOpen(false); router.push('/chat'); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View all in Team Chat →
                </button>
                <p className={cn('text-[10px] mt-2', isLive ? 'text-emerald-400/70' : 'text-amber-400/70')}>
                  {isLive ? 'Realtime connected' : 'Realtime reconnecting...'}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
