import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function UnauthorizedPage() {
  const t = await getTranslations('Pages.unauthorized');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07070E]">
      <div className="glass glow-inset rounded-2xl p-8 max-w-md w-full mx-6 text-center space-y-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto">
          <ShieldAlert className="w-7 h-7 text-red-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white/80">{t('title')}</h2>
          <p className="text-sm text-white/40 leading-relaxed">{t('description')}</p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('backDashboard')}
        </Link>
      </div>
    </div>
  );
}
