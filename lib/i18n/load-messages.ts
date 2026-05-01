import type { AbstractIntlMessages } from 'next-intl';
import type { AppLocale } from './constants';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';

const catalog: Record<AppLocale, AbstractIntlMessages> = { en, tr };

export function loadMessages(locale: AppLocale): AbstractIntlMessages {
  return catalog[locale];
}
