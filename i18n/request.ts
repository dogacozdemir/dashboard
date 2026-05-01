import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type AppLocale,
} from '@/lib/i18n/constants';
import { loadMessages } from '@/lib/i18n/load-messages';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as string | undefined;
  if (!locale || (locale !== 'en' && locale !== 'tr')) {
    const jar = await cookies();
    const c = jar.get(LOCALE_COOKIE)?.value;
    locale = c === 'en' || c === 'tr' ? c : DEFAULT_LOCALE;
  }
  return {
    locale,
    messages: loadMessages(locale as AppLocale),
  };
});
