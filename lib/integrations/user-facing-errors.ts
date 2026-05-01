import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/lib/i18n/constants';
import { resolveActionLocale } from '@/lib/i18n/resolve-action-locale';

/**
 * Maps vendor / SDK errors to premium UX copy. Raw strings are never shown to end users.
 * Full technical detail must be logged server-side before calling this.
 */
export async function mapIntegrationSyncErrorForUser(raw: string): Promise<string> {
  const locale = await resolveActionLocale();
  return mapIntegrationSyncErrorForUserWithLocale(raw, locale);
}

export async function mapIntegrationSyncErrorForUserWithLocale(
  raw: string,
  locale: AppLocale
): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
  const tl = raw.toLowerCase();

  if (
    /\b401\b/.test(tl) ||
    /\b403\b/.test(tl) ||
    /expired/.test(tl) ||
    /invalid.*token/.test(tl) ||
    /oauth/.test(tl) ||
    /token.*revoked/.test(tl) ||
    /invalid_grant/.test(tl)
  ) {
    return t('integrationOauthRefresh');
  }

  if (/decrypt|unpack|crypto/i.test(tl)) {
    return t('integrationDecrypt');
  }

  if (/rate.?limit|429|too many requests/.test(tl)) {
    return t('integrationRateLimit');
  }

  if (/meta|facebook|graph\.facebook/.test(tl) && /\b(4|5)\d{2}\b/.test(tl)) {
    return t('integrationMetaApi');
  }

  if (/google|googleads|ads\.google/.test(tl) && /\b(4|5)\d{2}\b/.test(tl)) {
    return t('integrationGoogleAdsApi');
  }

  if (/tiktok|business-api\.tiktok/.test(tl) && /\b(4|5)\d{2}\b/.test(tl)) {
    return t('integrationTiktokApi');
  }

  if (/gsc|search console|webmasters/.test(tl)) {
    return t('integrationGsc');
  }

  if (/network|fetch failed|econnreset|etimedout|socket/i.test(tl)) {
    return t('integrationNetwork');
  }

  return t('actionError');
}
