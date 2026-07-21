import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Sparkles, ArrowUpRight } from 'lucide-react';

const PROMPT_KEYS = ['p1', 'p2', 'p3', 'p4'] as const;

/**
 * Proactive entry points into MonoAI. Each prompt maps to a real assistant tool
 * (performance / creative context / calendar), so answers are grounded in data.
 */
export async function MonoAiSuggestions() {
  const t = await getTranslations('Features.MonoAiSuggestions');

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-5"
      style={{
        background:
          'radial-gradient(120% 120% at 12% 8%, rgba(156,112,178,0.14), rgba(255,255,255,0.02) 60%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(145deg, rgba(156,112,178,0.9), rgba(190,160,66,0.9))' }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white/85">{t('heading')}</p>
          <p className="text-[11px] text-white/40">{t('subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PROMPT_KEYS.map((key) => {
          const prompt = t(key);
          return (
            <Link
              key={key}
              href={`/mono-ai?q=${encodeURIComponent(prompt)}`}
              className="group flex items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-left transition-colors hover:border-[#bea042]/30 hover:bg-white/[0.06]"
            >
              <span className="min-w-0 text-[13px] leading-snug text-white/70 group-hover:text-white/90">
                {prompt}
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-[#bea042]" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
