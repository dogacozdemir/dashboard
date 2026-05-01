import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { loadMessages } from '@/lib/i18n/load-messages';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const cookieLang = jar.get(LOCALE_COOKIE)?.value;
  const locale = cookieLang === 'en' ? 'en' : 'tr';
  const messages = loadMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen flex items-center justify-center bg-[#0c070c] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(156,112,178,0.4) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(156,112,178,0.4) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-700/[0.07] blur-[130px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-amber-900/[0.06] blur-[110px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md px-6">{children}</div>
      </div>
    </NextIntlClientProvider>
  );
}
