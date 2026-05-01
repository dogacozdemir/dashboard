import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, type AppLocale, normalizeLocale } from './constants';

/** Cookie wins for instant switches; otherwise profile locale from session/JWT. */
export async function resolveEffectiveLocale(profileLocale?: string | null): Promise<AppLocale> {
  const jar = await cookies();
  const c = jar.get(LOCALE_COOKIE)?.value;
  if (c === 'en' || c === 'tr') return c;
  return normalizeLocale(profileLocale ?? DEFAULT_LOCALE);
}
