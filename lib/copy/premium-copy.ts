import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/lib/i18n/constants';
import { resolveActionLocale } from '@/lib/i18n/resolve-action-locale';

export async function getPremiumActionError(): Promise<string> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
  return t('actionError');
}

export async function getPremiumAdminActionError(): Promise<string> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
  return t('adminActionError');
}

export async function getPremiumIntegrationReconnectHint(): Promise<string> {
  const locale = await resolveActionLocale();
  const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
  return t('integrationReconnectHint');
}

/** When cookie/session are unavailable (e.g. tests), pass locale explicitly. */
export async function getPremiumActionErrorForLocale(locale: AppLocale): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
  return t('actionError');
}
