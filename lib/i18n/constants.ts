export const APP_LOCALES = ['tr', 'en'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'tr';

/** HttpOnly-friendly locale hint; Server Actions may also persist to users.locale */
export const LOCALE_COOKIE = 'madmonos.locale';

export function normalizeLocale(raw: string | null | undefined): AppLocale {
  if (raw === 'en') return 'en';
  return 'tr';
}
