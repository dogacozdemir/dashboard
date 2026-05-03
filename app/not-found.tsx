import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('Pages.notFound');

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#07070E] overflow-hidden px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
            filter: 'blur(72px)',
          }}
        />
      </div>

      <div
        className="relative z-10 w-full max-w-sm rounded-[2rem] p-8 text-center space-y-6"
        style={{
          background: 'rgba(22, 11, 22, 0.72)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(0,0,0,0.55), 0 0 80px rgba(99,102,241,0.12)',
          backdropFilter: 'blur(60px) saturate(220%)',
          WebkitBackdropFilter: 'blur(60px) saturate(220%)',
        }}
      >
        {/* Top rim */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-[2rem] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 mx-auto shadow-[0_0_32px_rgba(99,102,241,0.2)]">
          <Compass className="w-7 h-7 text-indigo-400" />
        </div>

        <div className="space-y-2">
          <p className="text-5xl font-bold gradient-text-indigo">404</p>
          <h2 className="text-lg font-semibold text-white/85">{t('title')}</h2>
          <p className="text-sm text-white/40 leading-relaxed">{t('description')}</p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('backDashboard')}
        </Link>
      </div>
    </div>
  );
}
