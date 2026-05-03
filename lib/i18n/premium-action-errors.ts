import { getTranslations } from 'next-intl/server';
import { resolveActionLocale } from '@/lib/i18n/resolve-action-locale';

/** User-facing copy when a server action or API route has no session (replaces raw "Unauthorized"). */
export async function premiumSessionRequiredMessage(): Promise<string> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
  return t('sessionRequired');
}

/** User-facing copy when persistence fails — never expose vendor/Postgres strings. */
export async function premiumDataPersistErrorMessage(): Promise<string> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
  return t('actionError');
}

/** Signed in but not allowed to perform this action (replaces raw Forbidden / English admin errors). */
export async function premiumForbiddenMessage(): Promise<string> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
  return t('adminActionError');
}
