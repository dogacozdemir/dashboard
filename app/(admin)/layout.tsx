import { redirect } from 'next/navigation';
import type { SessionUser } from '@/types/user';
import { auth } from '@/lib/auth/config';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { resolveEffectiveLocale } from '@/lib/i18n/resolve-effective-locale';
import { loadMessages } from '@/lib/i18n/load-messages';
import { AdminAppShell } from '@/features/admin/components/AdminAppShell';

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

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AdminAppShell userEmail={user?.email ?? null}>{children}</AdminAppShell>
    </NextIntlClientProvider>
  );
}
