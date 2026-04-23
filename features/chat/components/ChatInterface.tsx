'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, MessageSquare, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ensureRealtimeAuth } from '@/lib/supabase/realtime';
import { sendMessage } from '../actions/chatActions';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ChatMessage, MessageType } from '../types';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface ChatInterfaceProps {
  companyId: string;
  initialMessages: ChatMessage[];
  currentUserName: string;
}

const typeConfig: Record<MessageType, { icon: React.ComponentType<{ className?: string }>; bubble: string }> = {
  message:  { icon: MessageSquare, bubble: 'bg-indigo-500/15 border-indigo-500/20' },
  alert:    { icon: AlertCircle,   bubble: 'bg-amber-500/15 border-amber-500/20' },
  approval: { icon: CheckCircle2,  bubble: 'bg-emerald-500/15 border-emerald-500/20' },
  system:   { icon: Info,          bubble: 'bg-white/[0.05] border-white/[0.08]' },
};

export function ChatInterface({ companyId, initialMessages, currentUserName }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isLive, setIsLive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Supabase Realtime subscription
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
        .channel(`chat:${companyId}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'notifications',
            filter: `tenant_id=eq.${companyId}`,
          },
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
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
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

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

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

    startTransition(async () => {
      const result = await sendMessage(companyId, trimmed);
      if (!result.success) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function groupByDate(msgs: ChatMessage[]) {
    const groups: Array<{ date: string; messages: ChatMessage[] }> = [];
    let currentDate = '';
    for (const msg of msgs) {
      const date = new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  }

  const groups = groupByDate(messages);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[800px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/60">No messages yet</p>
              <p className="text-xs text-white/25 mt-1">Start a conversation with your Madmonos team below</p>
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[10px] text-white/25 font-medium">{group.date}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              <AnimatePresence initial={false}>
                {group.messages.map((msg) => {
                  const isMine = msg.senderName === currentUserName;
                  const { icon: TypeIcon, bubble } = typeConfig[msg.type];

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn('flex gap-3', isMine ? 'flex-row-reverse' : 'flex-row')}
                    >
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-white/50">
                          {msg.senderName.slice(0, 2).toUpperCase()}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div className={cn('max-w-[75%] space-y-1', isMine && 'items-end flex flex-col')}>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] text-white/40', isMine && 'order-2')}>
                            {msg.senderName}
                          </span>
                          <TypeIcon className="w-3 h-3 text-white/20" />
                        </div>
                        <div className={cn(
                          'px-4 py-2.5 rounded-2xl border text-sm text-white/80 leading-relaxed',
                          bubble,
                          isMine ? 'rounded-tr-md' : 'rounded-tl-md'
                        )}>
                          {msg.message}
                        </div>
                        <span className="text-[10px] text-white/20">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
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

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your team… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/90 placeholder-white/20 text-sm outline-none focus:border-indigo-500/40 resize-none transition-all leading-relaxed"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={isPending || !input.trim()}
            className="flex items-center justify-center w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-40 shrink-0"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-white/20 mt-2 px-1">
          Messages are visible to your Madmonos account team and are tied to this brand workspace.
        </p>
        <p className={cn('text-[10px] mt-1 px-1', isLive ? 'text-emerald-400/70' : 'text-amber-400/70')}>
          {isLive ? 'Realtime connected' : 'Realtime reconnecting...'}
        </p>
      </div>
    </div>
  );
}
