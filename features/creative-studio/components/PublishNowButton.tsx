'use client';

import { useState, useTransition } from 'react';
import { Send, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { publishInstagramPost } from '@/features/oauth/actions/publishInstagramPost';
import type { CreativePost } from '../types';

interface PublishNowButtonProps {
  post: CreativePost;
  companyId: string;
  onPublished: (postId: string, igMediaId: string) => void;
}

/**
 * Manual override for the scheduled publisher. Publishing is irreversible and
 * outward-facing, so it always takes a second, explicit confirmation — never a
 * single click.
 */
export function PublishNowButton({ post, companyId, onPublished }: PublishNowButtonProps) {
  const t = useTranslations('Features.Creative');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(post.publishError);
  const [pending, startPublish] = useTransition();

  if (post.platform !== 'instagram' || post.status !== 'approved') return null;

  if (post.publishState === 'published') {
    return (
      <a
        href={post.igMediaId ? `https://www.instagram.com/p/${post.igMediaId}` : '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1.5 text-[11px] font-medium text-emerald-300/90 transition-colors hover:bg-emerald-500/15"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {t('publishViewOnInstagram')}
      </a>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-rose-300/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{error}</span>
        </p>
      ) : null}

      {confirming ? (
        <div
          className="rounded-2xl border border-[#bea042]/25 px-3.5 py-3"
          style={{ background: 'rgba(190,160,66,0.08)', backdropFilter: 'blur(16px)' }}
        >
          <p className="text-[11px] leading-relaxed text-white/78">{t('publishConfirmBody')}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startPublish(async () => {
                  const res = await publishInstagramPost(companyId, post.id);
                  if (res.success) {
                    setConfirming(false);
                    onPublished(post.id, res.instagramMediaId);
                  } else {
                    setError(res.error);
                    setConfirming(false);
                  }
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#bea042]/35 bg-[#bea042]/15 px-3 py-1.5 text-[11px] font-medium text-[#e5cf8f] transition-colors hover:bg-[#bea042]/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {t('publishConfirmYes')}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-50"
            >
              {t('publishConfirmNo')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:border-[#bea042]/30 hover:bg-[#bea042]/10 hover:text-[#e5cf8f]"
        >
          <Send className="h-3.5 w-3.5" />
          {post.publishState === 'failed' ? t('publishRetry') : t('publishNow')}
        </button>
      )}
    </div>
  );
}
