'use client';

import { useState, useTransition } from 'react';
import {
  Plus, Loader2, RefreshCw, Trash2, ExternalLink, AlertTriangle, Radar, CheckCircle2, Tag,
  ChevronDown, History,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { formatRelativeTime } from '@/lib/utils/format';
import { formatDetectedPrice } from '@/lib/competitors/price';
import {
  addCompetitor, removeCompetitor, checkCompetitorNow,
} from '../actions/competitorActions';
import type { Competitor } from '../types';

interface CompetitorPanelProps {
  companyId: string;
  initial: Competitor[];
  canManage: boolean;
}

export function CompetitorPanel({ companyId, initial, canManage }: CompetitorPanelProps) {
  const t = useTranslations('Features.Competitors');
  const [competitors, setCompetitors] = useState<Competitor[]>(initial);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleAdd() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    startAdd(async () => {
      const res = await addCompetitor(companyId, { url: trimmed, name: name.trim() || undefined });
      if (!res.success) {
        setError(res.error ?? t('addError'));
        return;
      }
      setUrl('');
      setName('');
      const { fetchCompetitors } = await import('../actions/competitorActions');
      setCompetitors(await fetchCompetitors(companyId));
    });
  }

  function handleRemove(id: string) {
    setBusyId(id);
    startAdd(async () => {
      const res = await removeCompetitor(companyId, id);
      if (res.success) setCompetitors((prev) => prev.filter((c) => c.id !== id));
      setBusyId(null);
    });
  }

  function handleCheck(id: string) {
    setBusyId(id);
    startAdd(async () => {
      await checkCompetitorNow(companyId, id);
      const { fetchCompetitors } = await import('../actions/competitorActions');
      setCompetitors(await fetchCompetitors(companyId));
      setBusyId(null);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Radar className="h-4 w-4 text-[#9c70b2]" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">{t('sectionTitle')}</h2>
      </div>

      <GlassCard padding="lg" className="bento-card rounded-[2rem] border-white/10 backdrop-blur-3xl">
        <p className="text-[12px] leading-relaxed text-white/50">{t('intro')}</p>

        {canManage ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={t('urlPlaceholder')}
              className="min-w-0 flex-1 rounded-xl border border-white/[0.10] bg-white/[0.03] px-3 py-2 text-sm text-white/80 outline-none transition-colors placeholder:text-white/25 focus:border-[#9c70b2]/50"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={t('namePlaceholder')}
              className="w-full rounded-xl border border-white/[0.10] bg-white/[0.03] px-3 py-2 text-sm text-white/80 outline-none transition-colors placeholder:text-white/25 focus:border-[#9c70b2]/50 sm:w-40"
            />
            <button
              type="button"
              disabled={adding || !url.trim()}
              onClick={handleAdd}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#9c70b2]/30 bg-[#9c70b2]/15 px-4 py-2 text-sm font-medium text-[#c49bd6] transition-colors hover:bg-[#9c70b2]/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('add')}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-300/90">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : null}

        {competitors.length === 0 ? (
          <p className="mt-6 text-center text-sm text-white/35">{t('empty')}</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {competitors.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white/85">{c.name}</span>
                      {c.changeCount > 0 ? (
                        <span className="shrink-0 rounded-full bg-[#bea042]/15 px-2 py-0.5 text-[10px] font-medium text-[#e5cf8f]">
                          {t('changeCount', { count: c.changeCount })}
                        </span>
                      ) : null}
                    </div>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-white/35 transition-colors hover:text-[#9c70b2]"
                    >
                      {c.host}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </div>

                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => handleCheck(c.id)}
                        title={t('checkNow')}
                        className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-40"
                      >
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => handleRemove(c.id)}
                        title={t('remove')}
                        className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {(c.prices.length > 0 || c.priceChange) ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                    {c.prices.length > 0 ? (
                      <span className="text-[11px] text-white/55">
                        {t('priceSummary', { count: c.prices.length })}
                      </span>
                    ) : (
                      <span className="text-[11px] text-white/35">{t('noPricesDetected')}</span>
                    )}
                    {c.priceChange ? (
                      <span className="rounded-md border border-[#bea042]/30 bg-[#bea042]/10 px-2 py-0.5 text-[11px] font-semibold text-[#e5cf8f]">
                        {c.priceChange}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#c49bd6] transition-colors hover:bg-[#9c70b2]/10"
                    >
                      {expandedId === c.id ? t('hideDetail') : t('showDetail')}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${expandedId === c.id ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                ) : null}

                {expandedId === c.id ? (
                  <CompetitorDetail competitor={c} />
                ) : null}

                <div className="mt-2.5 border-t border-white/[0.05] pt-2.5">
                  {!c.latest ? (
                    <p className="text-[11px] text-white/35">{t('notCheckedYet')}</p>
                  ) : c.latest.changed && c.latest.changeSummary ? (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#bea042]" />
                      <div className="min-w-0">
                        <p className="whitespace-pre-line text-[12px] leading-relaxed text-white/75">
                          {c.latest.changeSummary}
                        </p>
                        <p className="mt-1 text-[10px] text-white/30">
                          {formatRelativeTime(c.latest.fetchedAt)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-white/40">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                      <span>{t('noChange')}</span>
                      <span className="text-white/25">
                        · {formatRelativeTime(c.lastCheckedAt ?? c.latest.fetchedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

/**
 * Expanded card body: product → price table (labeled rows first), unlabeled
 * prices grouped below it, then the recent change timeline.
 */
function CompetitorDetail({ competitor }: { competitor: Competitor }) {
  const t = useTranslations('Features.Competitors');
  const labeled = competitor.prices.filter((p) => p.label);
  const unlabeled = competitor.prices.filter((p) => !p.label);

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      {labeled.length > 0 ? (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {t('colProduct')}
              </th>
              <th className="pb-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {t('colPrice')}
              </th>
            </tr>
          </thead>
          <tbody>
            {labeled.map((p, i) => (
              <tr key={i} className="border-b border-white/[0.04] last:border-b-0">
                <td className="py-1.5 pr-3 text-[12px] text-white/75">{p.label}</td>
                <td className="py-1.5 text-right text-[12px] font-semibold tabular-nums text-emerald-300/90">
                  {formatDetectedPrice(p)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {unlabeled.length > 0 ? (
        <div className={labeled.length > 0 ? 'mt-3' : ''}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
            {labeled.length > 0 ? t('otherPrices') : t('detectedPrices')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unlabeled.map((p, i) => (
              <span
                key={i}
                className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white/70"
              >
                {formatDetectedPrice(p)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {competitor.prices.length === 0 ? (
        <p className="text-[11px] text-white/35">{t('noPricesDetected')}</p>
      ) : null}

      <div className="mt-3 border-t border-white/[0.05] pt-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
          <History className="h-3 w-3" />
          {t('historyTitle')}
        </p>
        {competitor.history.length === 0 ? (
          <p className="text-[11px] text-white/35">{t('noHistory')}</p>
        ) : (
          <ul className="space-y-1.5">
            {competitor.history.map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-white/30">
                  {formatRelativeTime(h.fetchedAt)}
                </span>
                <span className="min-w-0 whitespace-pre-line text-[11px] leading-relaxed text-white/60">
                  {h.changeSummary ?? t('changeNoSummary')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
