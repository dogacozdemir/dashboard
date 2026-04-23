'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Send, Loader2, Trash2, Zap, AlertCircle,
  FileText, Globe, Search, FolderSearch,
} from 'lucide-react';
import { sendAiMessage, clearAiHistory } from '../actions/aiChatActions';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { AiMessage } from '../types';

interface AiChatInterfaceProps {
  companyId:      string;
  tenantName:     string;
  initialHistory: AiMessage[];
}

const STARTER_PROMPTS = [
  'Analyze our current ad performance and suggest optimizations',
  'How can we improve our GEO visibility in ChatGPT and Perplexity?',
  'Create a 30-day content strategy brief as a PDF report',
  'Search web for latest Meta Ads algorithm changes in 2026',
];

// Tool name → display label + icon
const TOOL_META: Record<string, { label: string; Icon: React.ElementType }> = {
  generate_pdf:  { label: 'Generating PDF',    Icon: FileText    },
  web_fetch:     { label: 'Reading page',      Icon: Globe       },
  web_search:    { label: 'Searching web',     Icon: Search      },
  search_assets: { label: 'Searching assets',  Icon: FolderSearch },
};

// ─── SIMPLE MARKDOWN-LINK RENDERER ───────────────────────────────────────────
// Renders [text](url) as <a>, bare https://… as <a>, and **bold** as <strong>.
// Everything else is plain text.

interface Segment {
  type: 'text' | 'link' | 'bold';
  text:  string;
  href?: string;
}

function parseMessage(content: string): Segment[] {
  const segments: Segment[] = [];
  // Combined regex: markdown link, bare URL, bold
  const RE = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(https?:\/\/[^\s<>"]+)|(\*\*([^*]+)\*\*)/g;

  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = RE.exec(content)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', text: content.slice(last, match.index) });
    }

    if (match[1]) {
      // Markdown link [text](url)
      segments.push({ type: 'link', text: match[2], href: match[3] });
    } else if (match[4]) {
      // Bare URL
      segments.push({ type: 'link', text: match[4], href: match[4] });
    } else if (match[5]) {
      // **bold**
      segments.push({ type: 'bold', text: match[6] });
    }

    last = match.index + match[0].length;
  }

  if (last < content.length) {
    segments.push({ type: 'text', text: content.slice(last) });
  }

  return segments;
}

function MessageContent({ content }: { content: string }) {
  const segments = parseMessage(content);

  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === 'link') {
          return (
            <a
              key={i}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 break-all"
            >
              {seg.text}
            </a>
          );
        }
        if (seg.type === 'bold') {
          return <strong key={i} className="font-semibold text-white/90">{seg.text}</strong>;
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </span>
  );
}

// ─── THINKING INDICATOR ───────────────────────────────────────────────────────

function ThinkingIndicator({ toolHint }: { toolHint: string | null }) {
  const meta = toolHint ? TOOL_META[toolHint] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-3"
    >
      <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
        <Brain className="w-3.5 h-3.5 text-indigo-400" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-indigo-500/[0.08] border border-indigo-500/15">
        {meta ? (
          <div className="flex items-center gap-2">
            <meta.Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-xs text-indigo-400">{meta.label}…</span>
            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function AiChatInterface({ companyId, tenantName, initialHistory }: AiChatInterfaceProps) {
  const [messages,   setMessages]   = useState<AiMessage[]>(initialHistory);
  const [input,      setInput]      = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [toolHint,   setToolHint]   = useState<string | null>(null);
  const [isThinking, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Reset toolHint when idle
  useEffect(() => {
    if (!isThinking) setToolHint(null);
  }, [isThinking]);

  const handleSend = useCallback((text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isThinking) return;

    setInput('');
    setError(null);
    setToolHint(null);

    const tempUser: AiMessage = {
      id:        `u-${Date.now()}`,
      role:      'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    // Detect likely tool from user message (heuristic for indicator UX)
    if (/pdf|report|document|brief|generate/i.test(content))   setToolHint('generate_pdf');
    else if (/search|latest|news|current|2026/i.test(content)) setToolHint('web_search');
    else if (/fetch|read.*url|http/i.test(content))            setToolHint('web_fetch');
    else if (/asset|creative|brand|file|upload/i.test(content)) setToolHint('search_assets');

    startTransition(async () => {
      const result = await sendAiMessage(companyId, content, tenantName);
      if (result.error) {
        setError(result.error);
        return;
      }
      const aiMsg: AiMessage = {
        id:        `a-${Date.now()}`,
        role:      'assistant',
        content:   result.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    });
  }, [input, isThinking, companyId, tenantName]);

  function handleClear() {
    if (!confirm('Clear entire conversation history?')) return;
    startTransition(async () => {
      await clearAiHistory(companyId);
      setMessages([]);
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="text-xs font-semibold text-white/70">monoAI v1</span>
          <span className="text-[10px] text-white/25">
            · PDF · Web Search · Asset Search · Long-term Memory
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-[10px] text-white/25 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 flex items-center justify-center">
              <Brain className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/70">
                AI Strategist for {tenantName}
              </p>
              <p className="text-xs text-white/30 mt-1">
                Powered by monoAI v1 · PDF generation · Web research · Asset search
              </p>
            </div>

            {/* Capability pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {Object.entries(TOOL_META).map(([, { label, Icon }]) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/35"
                >
                  <Icon className="w-3 h-3" />
                  {label.replace('ing', '')}
                </div>
              ))}
            </div>

            {/* Starter prompts */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-2.5 text-[11px] text-white/50 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.07] hover:text-white/70 transition-colors text-left leading-relaxed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                    msg.role === 'assistant'
                      ? 'bg-indigo-500/20 border border-indigo-500/20'
                      : 'bg-white/[0.08] border border-white/[0.08]',
                  )}>
                    {msg.role === 'assistant'
                      ? <Brain className="w-3.5 h-3.5 text-indigo-400" />
                      : <Zap   className="w-3.5 h-3.5 text-white/50"  />}
                  </div>

                  {/* Bubble */}
                  <div className={cn('max-w-[80%] space-y-1', msg.role === 'user' && 'items-end flex flex-col')}>
                    <div className={cn(
                      'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                      msg.role === 'assistant'
                        ? 'bg-indigo-500/[0.08] border border-indigo-500/15 text-white/80 rounded-tl-md'
                        : 'bg-white/[0.07] border border-white/[0.08] text-white/80 rounded-tr-md',
                    )}>
                      <MessageContent content={msg.content} />
                    </div>
                    <span className="text-[10px] text-white/20 px-1">
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking / tool indicator */}
            {isThinking && <ThinkingIndicator toolHint={toolHint} />}
          </>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-white/[0.06]">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask your AI Strategist, generate a PDF report, search the web…"
            rows={1}
            disabled={isThinking}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/90 placeholder-white/20 text-sm outline-none focus:border-indigo-500/40 resize-none transition-all leading-relaxed disabled:opacity-50"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isThinking || !input.trim()}
            className="flex items-center justify-center w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-40 shrink-0"
          >
            {isThinking
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send    className="w-4 h-4"              />}
          </button>
        </div>
      </div>
    </div>
  );
}
