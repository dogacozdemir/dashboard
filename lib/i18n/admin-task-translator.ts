import { createTranslator } from 'next-intl';
import type { AppLocale } from '@/lib/i18n/constants';
import { DEFAULT_LOCALE } from '@/lib/i18n/constants';
import { loadMessages } from '@/lib/i18n/load-messages';

/** Server-side copy for admin_tasks / Lux notifications (defaults to product locale). */
export function createAdminTaskTranslator(locale: AppLocale = DEFAULT_LOCALE) {
  const messages = loadMessages(locale);
  return createTranslator({ locale, messages }) as (
    key: string,
    values?: Record<string, string | number | boolean | Date | null | undefined>,
  ) => string;
}
