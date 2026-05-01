'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Send, Loader2, Trash2, Zap, AlertCircle,
  FileText, Globe, Search, FolderSearch, Sparkles,
} from 'lucide-react';
import { sendAiMessage, clearAiHistory } from '../actions/aiChatActions';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset';
import { useTranslations } from 'next-intl';
import type { AiMessage } from '../types';

interface AiChatInterfaceProps {
  companyId:      string;
  tenantName:     string;
  initialHistory: AiMessage[];
}

type ToolHintKey = 'generate_pdf' | 'web_fetch' | 'web_search' | 'search_assets';

const STARTER_KEYS = ['starter0', 'starter1', 'starter2', 'starter3'] as const;

const TOOL_ICONS: Record<ToolHintKey, React.ElementType> = {
  generate_pdf:  FileText,
  web_fetch:     Globe,
  web_search:    Search,
  search_assets: FolderSearch,
};

const bubbleSpring = { type: 'spring' as const, stiffness: 280, damping: 26, mass: 0.9 };

/* ── Markdown-link renderer ── */
interface Segment { type: 'text' | 'link' | 'bold'; text: string; href?: string; }

function parseMessage(content: string): Segment[] {
  const segments: Segment[] = [];
  const RE = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(https?:\/\/[^\s<>"]+)|(\*\*([^*]+)\*\*)/g;
  let last = 0, match: RegExpExecArray | null;

  while ((match = RE.exec(content)) !== null) {
    if (match.index > last) segments.push({ type: 'text', text: content.slice(last, match.index) });
    if (match[1])      segments.push({ type: 'link', text: match[2], href: match[3] });
    else if (match[4]) segments.push({ type: 'link', text: match[4], href: match[4] });
    else if (match[5]) segments.push({ type: 'bold', text: match[6] });
    last = match.index + match[0].length;
  }
  if (last < content.length) segments.push({ type: 'text', text: content.slice(last) });
  return segments;
}

function MessageContent({ content }: { content: string }) {
  const segments = parseMessage(content);
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === 'link') return (
          <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer"
            className="text-[#b48dc8] underline underline-offset-2 hover:text-[#e3d0ea] break-all transition-colors">
            {seg.text}
          </a>
        );
        if (seg.type === 'bold') return <strong key={i} className="font-semibold text-white/95">{seg.text}</strong>;
        return <span key={i}>{seg.text}</span>;
      })}
    </span>
  );
}

/* ── Thinking indicator — glow pulse ── */
function ThinkingIndicator({
  toolHint,
  runningLabel,
}: {
  toolHint: string | null;
  /** Pre-resolved ICU label for active tool */
  runningLabel: string | null;
}) {
  const IconCmp = toolHint && toolHint in TOOL_ICONS
    ? TOOL_ICONS[toolHint as ToolHintKey]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={bubbleSpring}
      className="flex gap-2.5"
    >
      {/* AI avatar with breathing glow */}
      <motion.div
        className="w-7 h-7 rounded-xl shrink-0 mt-0.5 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #9c70b2, #562c52)' }}
        animate={{
          boxShadow: [
            '0 0 0px rgba(156,112,178,0)',
            '0 0 20px rgba(156,112,178,0.7)',
            '0 0 0px rgba(156,112,178,0)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Brain className="w-3.5 h-3.5 text-white" />
      </motion.div>

      <div
        className="px-4 py-3 rounded-2xl rounded-tl-[6px] border border-white/[0.10]"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)' }}
      >
        {IconCmp ? (
          <div className="flex items-center gap-2">
            <IconCmp className="w-3.5 h-3.5 text-[#9c70b2] shrink-0" />
            <span className="text-xs text-[#b48dc8]">{runningLabel ?? ''}</span>
            <Loader2 className="w-3 h-3 text-[#9c70b2] animate-spin" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#9c70b2]"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.15, 0.8] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Main component ── */
export function AiChatInterface({ companyId, tenantName, initialHistory }: AiChatInterfaceProps) {
  const t = useTranslations('Features.MonoAi');
  const [messages,   setMessages]   = useState<AiMessage[]>(initialHistory);
  const [input,      setInput]      = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [toolHint,   setToolHint]   = useState<string | null>(null);
  const [isThinking, startTransition] = useTransition();
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const vvInset = useVisualViewportInset();

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, isThinking]);

  useEffect(() => {
    if (!isThinking) setToolHint(null);
  }, [isThinking]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const handleSend = useCallback((text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isThinking) return;

    setInput('');
    setError(null);
    setToolHint(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const tempUser: AiMessage = {
      id: `u-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    if (/pdf|report|document|brief|generate/i.test(content))    setToolHint('generate_pdf');
    else if (/search|latest|news|current|2026/i.test(content))  setToolHint('web_search');
    else if (/fetch|read.*url|http/i.test(content))             setToolHint('web_fetch');
    else if (/asset|creative|brand|file|upload/i.test(content)) setToolHint('search_assets');

    startTransition(async () => {
      const result = await sendAiMessage(companyId, content, tenantName);
      if (result.error) { setError(result.error); return; }
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`, role: 'assistant', content: result.reply, createdAt: new Date().toISOString(),
      }]);
    });
  }, [input, isThinking, companyId, tenantName]);

  function handleClear() {
    if (!confirm(t('confirmClear'))) return;
    startTransition(async () => { await clearAiHistory(companyId); setMessages([]); });
  }

  const hasInput = input.trim().length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 relative">

      {/* ── Aurora orbs — soft motion behind messages ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <motion.div
          className="absolute -top-24 -left-16 w-[400px] h-[400px] rounded-full blur-[100px]"
          style={{ background: 'rgba(156,112,178,0.06)' }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-24 -right-16 w-[360px] h-[360px] rounded-full blur-[90px]"
          style={{ background: 'rgba(190,160,66,0.05)' }}
          animate={{ x: [0, -25, 0], y: [0, 20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ── Header ── */}
      <div className="shrink-0 relative z-10 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #9c70b2, #562c52)' }}
            animate={{ boxShadow: ['0 0 8px rgba(156,112,178,0.2)', '0 0 18px rgba(156,112,178,0.45)', '0 0 8px rgba(156,112,178,0.2)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Brain className="w-3.5 h-3.5 text-white" />
          </motion.div>
          <div>
            <p className="text-xs font-semibold text-white/80 leading-none">{t('headerTitle')}</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              {t('headerSubtitle')}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-[10px] text-white/20 hover:text-red-400/80 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            {t('clearHistory')}
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div
        className="relative z-10 flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-5 md:px-5"
        style={{
          scrollbarWidth: 'none',
          paddingBottom: vvInset > 0 ? `${Math.min(vvInset, 280) + 8}px` : undefined,
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={bubbleSpring}
            >
              <motion.div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto"
                style={{ background: 'linear-gradient(135deg, rgba(156,112,178,0.25), rgba(86,44,82,0.2))' }}
                animate={{ boxShadow: ['0 0 20px rgba(156,112,178,0.15)', '0 0 40px rgba(156,112,178,0.35)', '0 0 20px rgba(156,112,178,0.15)'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Brain className="w-7 h-7 text-[#9c70b2]" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...bubbleSpring, delay: 0.1 }}
            >
              <p className="text-sm font-semibold text-white/65 tracking-tight">
                {t('strategistFor', { tenant: tenantName })}
              </p>
              <p className="text-xs text-white/28 mt-1">
                {t('poweredBy')}
              </p>
            </motion.div>

            {/* Capability pills */}
            <motion.div
              className="flex flex-wrap justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {(Object.keys(TOOL_ICONS) as ToolHintKey[]).map((toolKey) => {
                const Icon = TOOL_ICONS[toolKey];
                const label = t(`toolPill.${toolKey}`);
                return (
                <div
                  key={toolKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] text-[10px] text-white/35"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </div>
              ); })}
            </motion.div>

            {/* Starter prompts — bento grid */}
            <motion.div
              className="grid grid-cols-2 gap-2 w-full max-w-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...bubbleSpring, delay: 0.25 }}
            >
              {STARTER_KEYS.map((key) => {
                const prompt = t(key);
                return (
                <motion.button
                  key={key}
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={bubbleSpring}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-3 text-[11px] text-white/45 border border-white/[0.07] rounded-2xl text-left leading-relaxed transition-colors line-clamp-4"
                  style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
                >
                  <Sparkles className="w-2.5 h-2.5 text-[#bea042]/40 mb-1.5" />
                  {prompt}
                </motion.button>
              ); })}
            </motion.div>
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={bubbleSpring}
                  className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                >
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: msg.role === 'assistant'
                        ? 'linear-gradient(135deg, #9c70b2, #562c52)'
                        : 'linear-gradient(135deg, rgba(190,160,66,0.3), rgba(160,123,40,0.2))',
                      border: msg.role === 'assistant' ? 'none' : '1px solid rgba(190,160,66,0.2)',
                    }}
                  >
                    {msg.role === 'assistant'
                      ? <Brain className="w-3.5 h-3.5 text-white" />
                      : <Zap   className="w-3.5 h-3.5 text-[#bea042]" />
                    }
                  </div>

                  {/* Bubble */}
                  <div
                    className={cn(
                      'flex max-w-[min(92%,36rem)] flex-col gap-0.5 md:max-w-[80%]',
                      msg.role === 'user' ? 'items-end' : 'items-start',
                    )}
                  >
                    {msg.role === 'user' ? (
                      <div
                        className="rounded-2xl rounded-tr-[6px] px-4 py-3 text-sm leading-relaxed text-white"
                        style={{
                          background: 'linear-gradient(135deg, #9c70b2 0%, #6d3b68 60%, #562c52 100%)',
                          boxShadow:
                            '0 4px 20px rgba(156,112,178,0.25), inset -4px 0 18px -6px rgba(190,160,66,0.42)',
                        }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        className="px-4 py-3 rounded-2xl rounded-tl-[6px] border border-white/[0.10] text-sm leading-relaxed text-white/82"
                        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)' }}
                      >
                        <MessageContent content={msg.content} />
                      </div>
                    )}
                    <span className="text-[9px] text-white/20 px-1">
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking */}
            {isThinking && (
              <ThinkingIndicator
                toolHint={toolHint}
                runningLabel={
                  toolHint && (toolHint as ToolHintKey) in TOOL_ICONS
                    ? `${t(`toolRunning.${toolHint as ToolHintKey}`)}…`
                    : null
                }
              />
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={bubbleSpring}
            className="flex items-start gap-2.5 px-4 py-3 rounded-2xl border border-red-500/20 text-red-400/80 text-xs"
            style={{ background: 'rgba(244,63,94,0.08)' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input Dock (visualViewport-aware) ── */}
      <div
        className="relative z-10 shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-4 md:pb-4"
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={t('inputPlaceholder')}
            rows={1}
            disabled={isThinking}
            className="flex-1 bg-transparent text-white/90 placeholder-white/22 text-sm outline-none resize-none leading-relaxed disabled:opacity-50"
            style={{ minHeight: 22, maxHeight: 120 }}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={bubbleSpring}
            onClick={() => handleSend()}
            disabled={isThinking || !hasInput}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-2xl transition-all duration-300 shrink-0',
              hasInput && !isThinking
                ? 'shadow-[0_0_16px_rgba(190,160,66,0.35)]'
                : 'bg-white/[0.06] border border-white/[0.06]',
            )}
            style={hasInput && !isThinking ? {
              background: 'linear-gradient(135deg, #d4b44c 0%, #bea042 50%, #a07b28 100%)',
            } : undefined}
          >
            {isThinking
              ? <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
              : <Send className={cn('w-3.5 h-3.5', hasInput ? 'text-black' : 'text-white/20')} />
            }
          </motion.button>
        </div>
      </div>
    </div>
  );
}
