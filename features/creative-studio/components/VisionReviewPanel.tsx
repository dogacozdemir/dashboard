'use client';

import { useState, useTransition } from 'react';
import { Eye, Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import {
  reviewCreativeVisually,
  type CreativeVisionReview,
} from '../actions/reviewCreativeVisually';

interface VisionReviewPanelProps {
  postId: string;
  companyId: string;
  /** Hidden entirely when the post has no still image to look at. */
  hasImageSlide: boolean;
}

const verdictStyle: Record<
  CreativeVisionReview['verdict'],
  { icon: React.ComponentType<{ className?: string }>; text: string; border: string; bg: string }
> = {
  ready: {
    icon: CheckCircle2,
    text: 'text-emerald-300/90',
    border: 'rgba(16,185,129,0.25)',
    bg: 'rgba(16,185,129,0.07)',
  },
  minor_issues: {
    icon: AlertTriangle,
    text: 'text-[#e5cf8f]',
    border: 'rgba(190,160,66,0.28)',
    bg: 'rgba(190,160,66,0.08)',
  },
  needs_work: {
    icon: XCircle,
    text: 'text-rose-300/90',
    border: 'rgba(244,63,94,0.25)',
    bg: 'rgba(244,63,94,0.07)',
  },
};

const severityDot: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-white/30',
  medium: 'bg-[#bea042]',
  high: 'bg-rose-400',
};

/**
 * Surfaces the one thing the chat assistant cannot do: actually look at the
 * artwork. Runs on demand — a review costs tokens, so it is never automatic.
 */
export function VisionReviewPanel({ postId, companyId, hasImageSlide }: VisionReviewPanelProps) {
  const t = useTranslations('Features.Creative');
  const [review, setReview] = useState<CreativeVisionReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const [pending, startReview] = useTransition();

  if (!hasImageSlide || unconfigured) return null;

  function run(force: boolean) {
    setError(null);
    startReview(async () => {
      const res = await reviewCreativeVisually(companyId, postId, { force });
      if (res.success) {
        setReview(res.review);
      } else {
        if (res.unconfigured) setUnconfigured(true);
        else setError(res.error);
      }
    });
  }

  const verdict = review ? verdictStyle[review.verdict] : null;
  const VerdictIcon = verdict?.icon;

  return (
    <div className="mt-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
          {t('visionReviewTitle')}
        </p>
        {review ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {t('visionReviewRerun')}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-rose-300/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{error}</span>
        </p>
      ) : null}

      {!review ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-[12px] font-medium text-white/70 transition-colors hover:border-[#9c70b2]/30 hover:bg-[#9c70b2]/10 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          {pending ? t('visionReviewRunning') : t('visionReviewCta')}
        </button>
      ) : (
        <div
          className="rounded-2xl border px-3.5 py-3"
          style={{
            borderColor: verdict?.border,
            background: verdict?.bg,
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold', verdict?.text)}>
            {VerdictIcon ? <VerdictIcon className="h-3.5 w-3.5 shrink-0" /> : null}
            {t(`visionVerdict_${review.verdict}`)}
          </div>

          <p className="mt-2 text-[12px] leading-relaxed text-white/78">{review.summary}</p>

          {review.strengths.length > 0 ? (
            <ul className="mt-2.5 space-y-1">
              {review.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] leading-snug text-emerald-200/80">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="min-w-0">{s}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {review.findings.length > 0 ? (
            <ul className="mt-3 space-y-2.5 border-t border-white/[0.08] pt-3">
              {review.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', severityDot[f.severity])}
                    aria-hidden
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">
                      {t(`visionArea_${f.area}`)}
                    </p>
                    <p className="text-[11px] leading-snug text-white/75">{f.note}</p>
                    <p className="text-[11px] leading-snug text-[#e5cf8f]/85">→ {f.suggestion}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-3 text-[9px] text-white/25">{t('visionReviewDisclaimer')}</p>
        </div>
      )}
    </div>
  );
}
