'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones,
  Loader2,
  MessageSquare,
  Search,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ensureRealtimeAuth } from '@/lib/supabase/realtime';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { isMadmonosSupportSender, MADMONOS_SUPPORT_SENDER } from '@/features/chat/constants';
import type { ChatMessage } from '@/features/chat/types';
import type { AdminChatTenantSummary } from '../actions/adminChatActions';
import {
  fetchAdminTenantMessages,
  sendAdminSupportMessage,
} from '../actions/adminChatActions';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

const spring = { type: 'spring' as const, stiffness: 280, damping: 26, mass: 0.9 };

type Props = {
  initialTenants: AdminChatTenantSummary[];
};

function groupByDate(msgs: ChatMessage[], localeTag: string) {
  const groups: Array<{ date: string; messages: ChatMessage[] }> = [];
  let currentDate = '';
  for (const msg of msgs) {
    const date = new Date(msg.createdAt).toLocaleDateString(localeTag, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

export function AdminChatHubClient({ initialTenants }: Props) {
  const t = useTranslations('Admin.chatHub');
  const locale = useLocale();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-US';

  const [tenants, setTenants] = useState(initialTenants);
  const [selectedId, setSelectedId] = useState<string | null>(initialTenants[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selected = useMemo(
    () => tenants.find((row) => row.id === selectedId) ?? null,
    [tenants, selectedId],
  );

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (row) => row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q),
    );
  }, [tenants, search]);

  useEffect(() => {
    setTenants(initialTenants);
  }, [initialTenants]);

  /* Sidebar: refresh last-message badges for any tenant thread */
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const connect = async () => {
      try {
        await ensureRealtimeAuth();
      } catch {
        return;
      }
      if (!isMounted) return;

      channel = supabase
        .channel('admin-support-sidebar')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
            const row = payload.new;
            const chatTypes = ['message', 'system', 'alert', 'approval'];
            if (!chatTypes.includes(row.type as string)) return;

            const tenantId = row.tenant_id as string;
            const senderName = row.sender_name as string;
            const needsSupport =
              row.type === 'message' && !isMadmonosSupportSender(senderName);

            setTenants((prev) =>
              prev.map((t) =>
                t.id === tenantId
                  ? {
                      ...t,
                      lastMessageAt: row.created_at as string,
                      lastMessagePreview: row.message as string,
                      lastSenderName: senderName,
                      needsSupport,
                    }
                  : t,
              ),
            );
          },
        )
        .subscribe();
    };

    void connect();
    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, selectedId]);

  const loadThread = useCallback(async (tenantId: string) => {
    setLoadingThread(true);
    setThreadError(null);
    try {
      const rows = await fetchAdminTenantMessages(tenantId);
      setMessages(rows);
    } catch {
      setThreadError(t('threadLoadError'));
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, [t]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  /* Realtime: live tenant ↔ support thread */
  useEffect(() => {
    if (!selectedId) return;

    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const connect = async () => {
      try {
        await ensureRealtimeAuth();
      } catch {
        if (isMounted) setIsLive(false);
        return;
      }
      if (!isMounted) return;

      channel = supabase
        .channel(`admin-support:${selectedId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `tenant_id=eq.${selectedId}`,
          },
          (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
            const row = payload.new;
            const chatTypes = ['message', 'system', 'alert', 'approval'];
            if (!chatTypes.includes(row.type as string)) return;

            const newMsg: ChatMessage = {
              id: row.id as string,
              tenantId: row.tenant_id as string,
              userId: (row.user_id as string | null) ?? null,
              senderName: row.sender_name as string,
              message: row.message as string,
              type: row.type as ChatMessage['type'],
              isRead: row.is_read as boolean,
              createdAt: row.created_at as string,
            };

            setMessages((prev) =>
              prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg],
            );

            setTenants((prev) =>
              prev.map((row) => {
                if (row.id !== selectedId) return row;
                const needsSupport =
                  newMsg.type === 'message' && !isMadmonosSupportSender(newMsg.senderName);
                return {
                  ...row,
                  lastMessageAt: newMsg.createdAt,
                  lastMessagePreview: newMsg.message,
                  lastSenderName: newMsg.senderName,
                  needsSupport,
                };
              }),
            );
          },
        )
        .subscribe((status: string) => {
          if (isMounted) setIsLive(status === 'SUBSCRIBED');
        });
    };

    void connect();
    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedId]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !selectedId || isPending) return;

    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      tenantId: selectedId,
      userId: null,
      senderName: MADMONOS_SUPPORT_SENDER,
      message: trimmed,
      type: 'message',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages((prev) => [...prev, optimistic]);

    startTransition(async () => {
      const res = await sendAdminSupportMessage(selectedId, trimmed);
      if (!res.success || !res.message) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setThreadError(res.error ?? t('sendError'));
        return;
      }

      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimistic.id);
        if (without.some((m) => m.id === res.message!.id)) return without;
        return [...without, res.message!];
      });

      setTenants((prev) =>
        prev.map((row) =>
          row.id === selectedId
            ? {
                ...row,
                lastMessageAt: res.message!.createdAt,
                lastMessagePreview: res.message!.message,
                lastSenderName: MADMONOS_SUPPORT_SENDER,
                needsSupport: false,
              }
            : row,
        ),
      );
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const groups = groupByDate(messages, localeTag);
  const hasInput = input.trim().length > 0;

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[32rem] flex-col gap-4">
      <header className="shrink-0 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/35">{t('eyebrow')}</p>
        <h1 className="text-2xl font-semibold tracking-tight gradient-text-indigo sm:text-3xl">{t('title')}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-white/40">{t('subtitle')}</p>
      </header>

      <div
        className="flex min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-white/[0.10]"
        style={{
          background: 'rgba(29, 15, 29, 0.42)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* ── Tenant sidebar ── */}
        <aside className="flex w-full max-w-[17.5rem] shrink-0 flex-col border-r border-white/[0.08] sm:max-w-xs">
          <div className="border-b border-white/[0.08] px-4 py-3.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/25" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] py-2 pl-9 pr-3 text-xs text-white/85 outline-none placeholder:text-white/25 focus:border-white/15"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredTenants.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-white/30">{t('noTenants')}</p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {filteredTenants.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          'w-full px-4 py-3.5 text-left transition-colors',
                          active ? 'bg-[#bea042]/10' : 'hover:bg-white/[0.03]',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white/88">{row.name}</p>
                            <p className="font-mono text-[10px] text-white/28">{row.slug}</p>
                          </div>
                          {row.needsSupport && (
                            <span className="shrink-0 rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                              {t('badgeSupport')}
                            </span>
                          )}
                        </div>
                        {row.lastMessagePreview && (
                          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/35">
                            {row.lastMessagePreview}
                          </p>
                        )}
                        {row.lastMessageAt && (
                          <p className="mt-1 text-[10px] text-white/22">
                            {formatRelativeTime(row.lastMessageAt)}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <section className="flex min-w-0 flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <Headphones className="size-10 text-white/20" />
              <p className="text-sm text-white/45">{t('selectTenant')}</p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-white/88">{selected.name}</p>
                  <p className="font-mono text-[10px] text-white/30">{selected.slug}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.span
                    className={cn('size-1.5 rounded-full', isLive ? 'bg-emerald-400' : 'bg-amber-400')}
                    animate={isLive ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <span className={cn('text-[10px]', isLive ? 'text-emerald-400/70' : 'text-amber-400/70')}>
                    {isLive ? t('live') : t('connecting')}
                  </span>
                </div>
              </div>

              <div
                className="mx-4 mt-3 flex shrink-0 items-start gap-2.5 rounded-2xl border border-amber-400/30 px-4 py-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(190,160,66,0.14) 0%, rgba(160,123,40,0.08) 100%)',
                }}
                role="status"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300/90" aria-hidden />
                <p className="text-xs font-medium leading-relaxed text-amber-100/90">{t('supportBanner')}</p>
              </div>

              {threadError && (
                <p role="alert" className="mx-4 mt-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200/90">
                  {threadError}
                </p>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 scrollbar-thin">
                {loadingThread ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-white/30" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <MessageSquare className="size-8 text-white/20" />
                    <p className="text-sm text-white/45">{t('emptyThread')}</p>
                  </div>
                ) : (
                  groups.map((group) => (
                    <div key={group.date} className="space-y-2">
                      <div className="flex items-center gap-3 py-2">
                        <div className="h-px flex-1 bg-white/[0.05]" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-white/20">
                          {group.date}
                        </span>
                        <div className="h-px flex-1 bg-white/[0.05]" />
                      </div>
                      <AnimatePresence initial={false}>
                        {group.messages.map((msg) => {
                          const isSupport = isMadmonosSupportSender(msg.senderName);
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={spring}
                              className={cn('flex', isSupport ? 'justify-end' : 'justify-start')}
                            >
                              <div
                                className={cn(
                                  'max-w-[min(92%,28rem)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                                  isSupport
                                    ? 'text-[#1a0f00]'
                                    : 'border border-white/[0.10] text-white/85',
                                )}
                                style={
                                  isSupport
                                    ? {
                                        background:
                                          'linear-gradient(135deg, #e8d48a 0%, #bea042 55%, #a07b28 100%)',
                                        boxShadow: '0 0 18px rgba(190,160,66,0.25)',
                                      }
                                    : { background: 'rgba(255,255,255,0.05)' }
                                }
                              >
                                {!isSupport && (
                                  <p className="mb-1 text-[10px] font-semibold text-white/40">
                                    {msg.senderName}
                                  </p>
                                )}
                                {isSupport && (
                                  <p className="mb-1 text-[10px] font-semibold text-[#1a0f00]/60">
                                    {MADMONOS_SUPPORT_SENDER}
                                  </p>
                                )}
                                {msg.message}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className="shrink-0 border-t border-white/[0.08] px-4 py-3">
                <div className="flex items-end gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.04] px-3 py-2.5">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      autoResize();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={t('inputPlaceholder')}
                    rows={1}
                    className="max-h-[120px] min-h-[22px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-white/90 outline-none placeholder:text-white/25"
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    transition={spring}
                    disabled={!hasInput || isPending}
                    onClick={handleSend}
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl transition-all',
                      hasInput && !isPending
                        ? 'shadow-[0_0_16px_rgba(190,160,66,0.35)]'
                        : 'border border-white/[0.06] bg-white/[0.06]',
                    )}
                    style={
                      hasInput && !isPending
                        ? {
                            background:
                              'linear-gradient(135deg, #d4b44c 0%, #bea042 50%, #a07b28 100%)',
                          }
                        : undefined
                    }
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin text-white/40" />
                    ) : (
                      <Send className={cn('size-4', hasInput ? 'text-black' : 'text-white/20')} />
                    )}
                  </motion.button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
