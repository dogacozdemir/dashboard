'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, MessageSquare, AlertCircle, CheckCircle2, Info, Zap } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ensureRealtimeAuth } from '@/lib/supabase/realtime';
import { sendMessage } from '../actions/chatActions';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset';
import { useTranslations, useLocale } from 'next-intl';
import type { ChatMessage, MessageType } from '../types';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface ChatInterfaceProps {
  companyId:        string;
  tenantName:       string;
  initialMessages:  ChatMessage[];
  currentUserName:  string;
}

const typeConfig: Record<MessageType, { icon: React.ComponentType<{ className?: string }> }> = {
  message:  { icon: MessageSquare },
  alert:    { icon: AlertCircle   },
  approval: { icon: CheckCircle2  },
  system:   { icon: Info          },
};

const bubbleSpring = { type: 'spring' as const, stiffness: 280, damping: 26, mass: 0.9 };

function isConsecutive(msgs: ChatMessage[], idx: number): boolean {
  if (idx === 0) return false;
  return msgs[idx - 1].senderName === msgs[idx].senderName;
}

function groupByDate(msgs: ChatMessage[], localeTag: string) {
  const groups: Array<{ date: string; messages: ChatMessage[] }> = [];
  let currentDate = '';
  for (const msg of msgs) {
    const date = new Date(msg.createdAt).toLocaleDateString(localeTag, {
      month: 'long', day: 'numeric', year: 'numeric',
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

export function ChatInterface({ companyId, tenantName, initialMessages, currentUserName }: ChatInterfaceProps) {
  const t = useTranslations('Features.Chat');
  const locale = useLocale();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-US';
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput]       = useState('');
  const [isPending, startTransition] = useTransition();
  const [isLive, setIsLive]     = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const vvInset = useVisualViewportInset();

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  /* Auto-resize textarea */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  /* Supabase Realtime */
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const connect = async () => {
      try { await ensureRealtimeAuth(); } catch { if (isMounted) setIsLive(false); }
      if (!isMounted) return;

      channel = supabase
        .channel(`chat:${companyId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${companyId}` },
          (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
            const row = payload.new as Record<string, unknown>;
            const newMsg: ChatMessage = {
              id:         row.id as string,
              tenantId:   row.tenant_id as string,
              userId:     row.user_id as string | null,
              senderName: row.sender_name as string,
              message:    row.message as string,
              type:       row.type as MessageType,
              isRead:     row.is_read as boolean,
              createdAt:  row.created_at as string,
            };
            setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          }
        )
        .subscribe((status: string) => { if (isMounted) setIsLive(status === 'SUBSCRIBED'); });
    };
    void connect();
    return () => { isMounted = false; if (channel) supabase.removeChannel(channel); };
  }, [companyId]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isPending) return;

    const optimistic: ChatMessage = {
      id:         `optimistic-${Date.now()}`,
      tenantId:   companyId,
      userId:     null,
      senderName: currentUserName,
      message:    trimmed,
      type:       'message',
      isRead:     false,
      createdAt:  new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    startTransition(async () => {
      const result = await sendMessage(companyId, trimmed);
      if (!result.success) setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const groups = groupByDate(messages, localeTag);
  const hasInput = input.trim().length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Sticky header ── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #9c70b2, #562c52)' }}
          >
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white/80 leading-none">{t('teamChatTitle')}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{t('workspaceSubtitle', { tenant: tenantName })}</p>
          </div>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <motion.span
            className={cn('w-1.5 h-1.5 rounded-full', isLive ? 'bg-emerald-400' : 'bg-amber-400')}
            animate={isLive ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className={cn('text-[10px]', isLive ? 'text-emerald-400/70' : 'text-amber-400/70')}>
            {isLive ? t('live') : t('connecting')}
          </span>
        </div>
      </div>

      {/* ── Message list ── */}
      <div
        className="flex-1 min-h-0 space-y-1 overflow-y-auto px-3 py-4 md:px-4"
        style={{
          scrollbarWidth: 'none',
          paddingBottom: vvInset > 0 ? `${Math.min(vvInset, 280) + 8}px` : undefined,
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={bubbleSpring}
              className="w-16 h-16 rounded-3xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(156,112,178,0.2), rgba(86,44,82,0.15))' }}
            >
              <MessageSquare className="w-7 h-7 text-[#9c70b2]" />
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-white/60 tracking-tight">{t('emptyTitle')}</p>
              <p className="text-xs text-white/25 mt-1">{t('emptySubtitle')}</p>
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="space-y-1">
              {/* Date separator */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-white/[0.05]" />
                <span className="text-[10px] text-white/20 font-medium tracking-wider uppercase">{group.date}</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>

              <AnimatePresence initial={false}>
                {group.messages.map((msg, idx) => {
                  const isMine = msg.senderName === currentUserName;
                  const consecutive = isConsecutive(group.messages, idx);
                  const { icon: TypeIcon } = typeConfig[msg.type];
                  const isSystem = msg.type !== 'message';

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={bubbleSpring}
                      className={cn(
                        'flex gap-2.5',
                        isMine ? 'flex-row-reverse' : 'flex-row',
                        consecutive ? 'mt-0.5' : 'mt-3',
                      )}
                    >
                      {/* Avatar — only for first in group */}
                      <div className="w-7 shrink-0 flex flex-col justify-end">
                        {!consecutive && (
                          <div
                            className="w-7 h-7 rounded-xl flex items-center justify-center"
                            style={{
                              background: isMine
                                ? 'linear-gradient(135deg, #9c70b2, #562c52)'
                                : 'rgba(255,255,255,0.07)',
                              border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            {isMine
                              ? <Zap className="w-3 h-3 text-white" />
                              : <span className="text-[9px] font-bold text-white/50">
                                  {msg.senderName.slice(0, 2).toUpperCase()}
                                </span>
                            }
                          </div>
                        )}
                      </div>

                      {/* Bubble group */}
                      <div
                        className={cn(
                          'flex max-w-[min(92%,36rem)] flex-col gap-0.5 md:max-w-[72%]',
                          isMine ? 'items-end' : 'items-start',
                        )}
                      >
                        {/* Sender name — only first in group */}
                        {!consecutive && !isMine && (
                          <span className="text-[10px] text-white/35 px-1 font-medium tracking-tight">
                            {msg.senderName}
                          </span>
                        )}

                        {/* Bubble */}
                        {isMine ? (
                          <div
                            className={cn(
                              'px-4 py-2.5 text-sm leading-relaxed text-white',
                              'rounded-2xl',
                              consecutive ? 'rounded-tr-2xl' : 'rounded-tr-[6px]',
                            )}
                            style={{
                              background: 'linear-gradient(135deg, #9c70b2 0%, #6d3b68 60%, #562c52 100%)',
                              boxShadow:
                                '0 4px 20px rgba(156,112,178,0.25), inset -4px 0 18px -6px rgba(190,160,66,0.42)',
                            }}
                          >
                            {msg.message}
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'px-4 py-2.5 text-sm leading-relaxed text-white/85',
                              'rounded-2xl border border-white/[0.10]',
                              isSystem ? 'border-[#bea042]/20' : '',
                              consecutive ? 'rounded-tl-2xl' : 'rounded-tl-[6px]',
                            )}
                            style={{
                              background: isSystem
                                ? 'rgba(190,160,66,0.06)'
                                : 'rgba(255,255,255,0.05)',
                              backdropFilter: 'blur(16px)',
                            }}
                          >
                            {isSystem && (
                              <TypeIcon className="w-3 h-3 inline mr-1.5 text-[#bea042]/70 -translate-y-px" />
                            )}
                            {msg.message}
                          </div>
                        )}

                        {/* Timestamp — only last in group (approximated: always show) */}
                        {!consecutive && (
                          <span className="text-[9px] text-white/20 px-1">
                            {formatRelativeTime(msg.createdAt)}
                          </span>
                        )}
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

      {/* ── Input Dock (visualViewport-aware on mobile) ── */}
      <div
        className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-4 md:pb-4"
        style={{
          transform: vvInset > 0 ? `translateY(-${vvInset}px)` : undefined,
          transition: 'transform 0.2s ease-out',
        }}
      >
        <div
          className={cn(
            'madmonos-composer-glass flex items-end gap-2.5 border border-white/[0.10] px-3 py-2.5 transition-all md:gap-3 md:rounded-3xl md:px-4 md:py-3',
            'rounded-full max-md:pl-4 max-md:pr-2 max-md:py-2',
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            rows={1}
            className="flex-1 bg-transparent text-white/90 placeholder-white/25 text-sm outline-none resize-none leading-relaxed"
            style={{ minHeight: 22, maxHeight: 120 }}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={bubbleSpring}
            onClick={handleSend}
            disabled={isPending || !hasInput}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-2xl transition-all duration-300 shrink-0',
              hasInput && !isPending
                ? 'shadow-[0_0_16px_rgba(190,160,66,0.35)]'
                : 'bg-white/[0.06] border border-white/[0.06]',
            )}
            style={hasInput && !isPending ? {
              background: 'linear-gradient(135deg, #d4b44c 0%, #bea042 50%, #a07b28 100%)',
            } : undefined}
          >
            {isPending
              ? <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
              : <Send className={cn('w-3.5 h-3.5', hasInput ? 'text-black' : 'text-white/20')} />
            }
          </motion.button>
        </div>
        <p className="text-[9px] text-white/15 mt-2 px-2 text-center tracking-wide">
          {t('footerHint')}
        </p>
      </div>
    </div>
  );
}
