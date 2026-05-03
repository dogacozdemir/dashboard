import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, Globe, Upload, Settings, Shield, Sparkles, ListTodo } from 'lucide-react';
import type { SessionUser } from '@/types/user';
import { auth } from '@/lib/auth/config';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { resolveEffectiveLocale } from '@/lib/i18n/resolve-effective-locale';
import { loadMessages } from '@/lib/i18n/load-messages';

const adminNav = [
  { href: '/', labelKey: 'controlCenter' as const, icon: Sparkles },
  { href: '/to-do', labelKey: 'opsCenter' as const, icon: ListTodo },
  { href: '/tenants', labelKey: 'tenants' as const, icon: LayoutDashboard },
  { href: '/roles', labelKey: 'roleArchitect' as const, icon: Shield },
  { href: '/subdomains', labelKey: 'subdomains' as const, icon: Globe },
  { href: '/uploads', labelKey: 'uploads' as const, icon: Upload },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  if (!session) {
    redirect('/login');
  }
  if (user?.role !== 'super_admin') {
    redirect('/unauthorized');
  }

  const locale = await resolveEffectiveLocale(user.locale);
  setRequestLocale(locale);
  const messages = loadMessages(locale);
  const t = await getTranslations({ locale, namespace: 'Admin' });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex h-screen overflow-hidden bg-[#07070E]">
        <aside className="w-56 flex flex-col h-screen border-r border-white/[0.06] bg-[#0F0F1A] shrink-0">
          <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06]">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 shrink-0">
              <Image
                src="/madmonos-logo-optimized.png"
                alt="Madmonos logo"
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain"
                priority
              />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm text-white/90 block truncate">{t('sidebarTitle')}</span>
              <p className="text-[10px] text-white/30 uppercase tracking-widest truncate">{t('sidebarSubtitle')}</p>
            </div>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
            {adminNav.map(({ href, labelKey, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors min-w-0"
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t(`nav.${labelKey}`)}</span>
              </Link>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/20 truncate">{user?.email}</p>
            <p className="text-[10px] text-red-400/60 uppercase tracking-wider mt-0.5">{t('footerAccess')}</p>
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="flex items-center justify-between px-6 h-16 border-b border-white/[0.06] shrink-0 gap-3">
            <p className="text-xs text-white/30 min-w-0 truncate">
              <span className="text-red-400/70">● {t('headerLive')}</span>
              &nbsp;·&nbsp;{t('headerTitle')}
            </p>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              {t('platformSettings')}
            </button>
          </header>
          <main className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">{children}</main>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
