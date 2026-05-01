'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Bell,
  Sparkles,
  Briefcase,
  Cpu,
  X,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ensureRealtimeAuth } from '@/lib/supabase/realtime';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { LuxNotificationItem, NotificationCategory } from '@/features/notifications/types';
import { mapRowToLuxNotification } from '@/features/notifications/lib/mapNotificationRow';
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/features/notifications/actions/notificationActions';
import { useTranslations } from 'next-intl';

const CATEGORY_ORDER: NotificationCategory[] = ['ai_strategic', 'operational', 'system'];

const CATEGORY_META: Record<
  NotificationCategory,
  { labelKey: string; subKey: string; icon: typeof Sparkles; accent: string }
> = {
  ai_strategic: {
    labelKey: 'categoryAiStrategic',
    subKey: 'categoryAiStrategicSub',
    icon: Sparkles,
    accent: 'text-[#bea042]',
  },
  operational: {
    labelKey: 'categoryOperational',
    subKey: 'categoryOperationalSub',
    icon: Briefcase,
    accent: 'text-violet-300/90',
  },
  system: {
    labelKey: 'categorySystem',
    subKey: 'categorySystemSub',
    icon: Cpu,
    accent: 'text-cyan-300/80',
  },
};

interface NotificationCenterProps {
  companyId: string;
  initialNotifs: LuxNotificationItem[];
  /** Lux center: notifications.view (or chat.send for legacy team chat access). */
  enabled: boolean;
}

export function NotificationCenter({ companyId, initialNotifs, enabled }: NotificationCenterProps) {
  const t = useTranslations('Features.Notifications');
  const [notifs, setNotifs] = useState<LuxNotificationItem[]>(initialNotifs);
  const [open, setOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [strategicPulse, setStrategicPulse] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const notifSheetMobile = useMediaQuery('(max-width: 767px)');
  const sheetDrag = useDragControls();
  /** Unique channel topic — TopBar mounts two NotificationCenters (md:hidden vs hidden md:flex); same name would reuse an already-subscribed channel. */
  const realtimeChannelId = useId().replace(/:/g, '');

  const resolveDefaultAction = useCallback(
    (n: LuxNotificationItem): { url: string; label: string } => {
      if (n.actionUrl && n.actionLabel) {
        return { url: n.actionUrl, label: n.actionLabel };
      }
      if (n.actionUrl) {
        return { url: n.actionUrl, label: t('actionGo') };
      }
      switch (n.category) {
        case 'ai_strategic':
          return { url: '/strategy', label: t('actionStrategy') };
        case 'operational':
          return { url: '/creative', label: t('actionCreative') };
        default:
          return { url: '/performance', label: t('actionPerformance') };
      }
    },
    [t]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const unread = useMemo(() => notifs.filter((n) => !n.isRead).length, [notifs]);
  const unreadStrategic = useMemo(
    () => notifs.filter((n) => !n.isRead && n.category === 'ai_strategic').length,
    [notifs]
  );

  useEffect(() => {
    if (!enabled || !companyId) return;
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const rowToLux = (row: Record<string, unknown>) =>
      mapRowToLuxNotification({
        id: row.id as string,
        message: row.message as string,
        type: row.type as string,
        sender_name: row.sender_name as string,
        is_read: row.is_read as boolean,
        created_at: row.created_at as string,
        category: row.category as string | null | undefined,
        action_url: row.action_url as string | null | undefined,
        action_label: row.action_label as string | null | undefined,
      });

    const connect = async () => {
      try {
        await ensureRealtimeAuth();
      } catch {
        if (isMounted) setIsLive(false);
      }
      if (!isMounted) return;

      channel = supabase
        .channel(`lux-notif:${companyId}:${realtimeChannelId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${companyId}` },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new;
            const item = rowToLux(row);
            setNotifs((prev) => [item, ...prev].slice(0, 40));
            if (item.category === 'ai_strategic') {
              setStrategicPulse((p) => p + 1);
              setRippleKey((k) => k + 1);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${companyId}` },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new;
            const item = rowToLux(row);
            setNotifs((prev) => prev.map((n) => (n.id === item.id ? item : n)));
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
  }, [companyId, enabled, realtimeChannelId]);

  useEffect(() => {
    if (!strategicPulse) return;
    const t = setTimeout(() => setStrategicPulse(0), 4200);
    return () => clearTimeout(t);
  }, [strategicPulse]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const onMarkAllRead = useCallback(async () => {
    const res = await markAllNotificationsRead(companyId);
    if (res.success) setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, [companyId]);

  const onAction = useCallback(
    async (n: LuxNotificationItem) => {
      const { url } = resolveDefaultAction(n);
      await markNotificationRead(companyId, n.id);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setOpen(false);
      router.push(url.startsWith('/') ? url : `/${url}`);
    },
    [companyId, router, resolveDefaultAction]
  );

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: notifs.filter((n) => n.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [notifs]);

  if (!enabled) return null;

  const panelBody = (
    <>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#bea042]/35 to-transparent" />

      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-4 pt-5 max-md:pt-4 md:px-6 md:pt-7">
              <div>
                <p
                  id="lux-notif-title"
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35"
                >
                  {t('luxTitle')}
                </p>
                <h2 className="text-lg font-semibold text-white/90 tracking-tight mt-1">
                  {t('heading')}
                </h2>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  {t('subtitleUnread', { count: unread })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl p-2 text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={() => void onMarkAllRead()}
                    className="text-[10px] font-semibold uppercase tracking-wider text-[#bea042]/90 hover:text-[#e8d48a] transition-colors"
                  >
                    {t('markAllRead')}
                  </button>
                ) : null}
              </div>
            </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-8 scrollbar-thin">
              {grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-4">
                  <Bell className="w-8 h-8 text-white/10" />
                  <p className="text-sm text-white/35">{t('emptyTitle')}</p>
                  <p className="text-xs text-white/25">{t('emptySubtitle')}</p>
                </div>
              ) : (
                grouped.map((group) => {
                  const meta = CATEGORY_META[group.category];
                  const Icon = meta.icon;
                  return (
                    <div key={group.category} className="space-y-2">
                      <div className="flex items-center gap-2 px-2 pt-1">
                        <Icon className={cn('w-3.5 h-3.5', meta.accent)} />
                        <span className={cn('text-[11px] font-semibold uppercase tracking-wider', meta.accent)}>
                          {t(meta.labelKey)}
                        </span>
                        <span className="text-[10px] text-white/25">· {t(meta.subKey)}</span>
                      </div>
                      {group.category === 'ai_strategic' ? (
                        <div className="h-px mx-2 bg-gradient-to-r from-[#bea042]/50 via-[#9c70b2]/30 to-transparent rounded-full" />
                      ) : (
                        <div className="h-px mx-2 bg-white/[0.06]" />
                      )}
                      <ul className="space-y-2">
                        {group.items.map((n) => {
                          const action = resolveDefaultAction(n);
                          const isStrategic = n.category === 'ai_strategic';
                          return (
                            <li key={n.id}>
                              <motion.div
                                layout
                                className={cn(
                                  'rounded-2xl border transition-all duration-300 overflow-hidden',
                                  'hover:bg-white/[0.05] hover:border-[#bea042]/20 hover:shadow-[0_0_24px_rgba(190,160,66,0.08)]',
                                  !n.isRead
                                    ? isStrategic
                                      ? 'bg-[#bea042]/[0.06] border-[#bea042]/25 shadow-[0_0_28px_rgba(190,160,66,0.12)]'
                                      : 'bg-white/[0.04] border-white/[0.1]'
                                    : 'bg-white/[0.02] border-white/[0.06] opacity-80'
                                )}
                              >
                                <div className="px-4 py-3 space-y-2">
                                  <p className="text-sm text-white/80 leading-snug">{n.message}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-white/30">
                                    <span>{n.senderName}</span>
                                    <span>·</span>
                                    <span>{formatRelativeTime(n.createdAt)}</span>
                                    {!n.isRead ? (
                                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#bea042] shadow-[0_0_8px_rgba(190,160,66,0.8)]" />
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void onAction(n)}
                                    className={cn(
                                      'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors',
                                      isStrategic
                                        ? 'bg-[#bea042]/15 text-[#e8d48a] border border-[#bea042]/35 hover:bg-[#bea042]/25'
                                        : 'bg-white/[0.06] text-white/75 border border-white/[0.1] hover:bg-white/[0.1]'
                                    )}
                                  >
                                    {action.label}
                                    <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                                  </button>
                                </div>
                              </motion.div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}
      </div>

      <div
        className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6"
        style={{ background: 'rgba(0,0,0,0.15)' }}
      >
        <span
          className={cn(
            'flex items-center gap-1.5 text-[10px]',
            isLive ? 'text-emerald-400/75' : 'text-amber-400/70'
          )}
        >
          <Radio className="h-3 w-3" />
          {isLive ? t('realtimeConnected') : t('reconnecting')}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            router.push('/chat');
          }}
          className="text-[10px] text-white/35 transition-colors hover:text-[#bea042]/80"
        >
          {t('teamChat')}
        </button>
      </div>
    </>
  );

  const panel = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="lux-notif-backdrop"
            type="button"
            aria-label={t('ariaCloseBackdrop')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] w-full cursor-default border-0 bg-[#050308]/35 p-0 backdrop-blur-[8px]"
            onClick={() => setOpen(false)}
          />
          {notifSheetMobile ? (
            <motion.div
              key="lux-notif-panel-mobile"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lux-notif-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.92 }}
              drag="y"
              dragControls={sheetDrag}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.28 }}
              onDragEnd={(_, info) => {
                if (info.velocity.y > 480 || info.offset.y > 88) setOpen(false);
              }}
              className={cn(
                'fixed inset-x-0 bottom-0 z-[210] flex max-h-[min(92dvh,100%)] flex-col rounded-t-[1.75rem]',
                'border border-b-0 border-white/[0.1] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]',
              )}
              style={{
                background: 'rgba(18, 10, 22, 0.88)',
                backdropFilter: 'var(--mm-glass-blur)',
                WebkitBackdropFilter: 'var(--mm-glass-blur)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.06), 0 -32px 120px rgba(0,0,0,0.45), 0 0 80px rgba(156,112,178,0.06)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              <button
                type="button"
                aria-label={t('ariaDragClose')}
                onPointerDown={(e) => sheetDrag.start(e)}
                className="flex shrink-0 touch-none cursor-grab flex-col items-center gap-2 py-2 active:cursor-grabbing"
              >
                <span className="h-1.5 w-11 rounded-full bg-white/25" />
              </button>
              {panelBody}
            </motion.div>
          ) : (
            <motion.aside
              key="lux-notif-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lux-notif-title"
              initial={{ x: '100%', opacity: 0.92 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }}
              className={cn(
                'fixed top-0 right-0 z-[210] flex h-full w-full max-w-[440px] flex-col',
                'rounded-l-[1.75rem] border-b border-l border-t border-white/[0.1]',
                'shadow-[-24px_0_80px_rgba(0,0,0,0.55)]',
              )}
              style={{
                background: 'rgba(18, 10, 22, 0.72)',
                backdropFilter: 'blur(40px) saturate(200%)',
                WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                boxShadow:
                  'inset 1px 0 0 rgba(255,255,255,0.06), -32px 0 120px rgba(0,0,0,0.45), 0 0 80px rgba(156,112,178,0.06)',
              }}
            >
              {panelBody}
            </motion.aside>
          )}
        </>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className="relative">
      <motion.button
        type="button"
        aria-label={t('ariaBell')}
        aria-expanded={open}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-2xl border transition-all duration-300',
          'bg-white/[0.05] border-white/[0.08] text-white/50 hover:text-[#bea042]/90 hover:border-[#bea042]/30',
          'hover:shadow-[0_0_20px_rgba(190,160,66,0.15)]'
        )}
        style={
          strategicPulse
            ? {
                boxShadow:
                  '0 0 0 1px rgba(190,160,66,0.35), 0 0 28px rgba(156,112,178,0.35), 0 0 40px rgba(190,160,66,0.2)',
              }
            : unreadStrategic > 0
              ? {
                  boxShadow: '0 0 18px rgba(190,160,66,0.18), 0 0 32px rgba(156,112,178,0.12)',
                }
              : undefined
        }
        animate={strategicPulse ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={strategicPulse ? { duration: 0.5, times: [0, 0.35, 1] } : { duration: 0.2 }}
      >
        <AnimatePresence>
          {rippleKey > 0 ? (
            <motion.span
              key={rippleKey}
              className="pointer-events-none absolute inset-0 rounded-2xl border border-[#bea042]/50"
              initial={{ opacity: 0.65, scale: 1 }}
              animate={{ opacity: 0, scale: 1.45 }}
              transition={{ duration: 0.95, ease: 'easeOut' }}
            />
          ) : null}
        </AnimatePresence>
        <Bell className="w-4 h-4 relative z-[1]" />
        {unread > 0 ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 text-[10px] font-bold text-[#1a0f00] z-[2]"
            style={{
              background: 'linear-gradient(135deg, #e8d48a, #bea042)',
              boxShadow: '0 0 12px rgba(190,160,66,0.5)',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        ) : null}
      </motion.button>

      {mounted ? createPortal(panel, document.body) : null}
    </div>
  );
}
