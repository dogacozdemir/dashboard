'use client';

import { useState, useTransition } from 'react';
import { Printer, Mail, Loader2, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { emailBoardReport } from '../actions/emailBoardReport';

export function BoardReportActions() {
  const t = useTranslations('Features.BoardReport');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setMsg(null);
    start(async () => {
      const res = await emailBoardReport(email);
      setMsg(res.success ? { ok: true, text: t('sent') } : { ok: false, text: res.error ?? t('sendFail') });
      if (res.success) {
        setEmail('');
        setTimeout(() => setOpen(false), 1500);
      }
    });
  }

  return (
    <div className="board-report-actions no-print flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08]"
        >
          <Printer className="h-4 w-4" />
          {t('print')}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#9c70b2]/25 transition-all"
          style={{ background: 'linear-gradient(90deg, #9c70b2, #bea042)' }}
        >
          <Mail className="h-4 w-4" />
          {t('email')}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.03] p-3 sm:flex-row sm:items-center">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('recipientPlaceholder')}
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 outline-none focus:border-[#9c70b2]/50"
          />
          <button
            type="button"
            onClick={send}
            disabled={pending || !email.includes('@')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9c70b2]/20 px-4 py-2 text-sm font-medium text-white/85 disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('sendCta')}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-white/40 hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {msg && (
        <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>
      )}
    </div>
  );
}
