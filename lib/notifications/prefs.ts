/** Per-user notification channel preferences. Opt-out model: absent = enabled. */
export type NotificationPrefKey = 'emailCreativeReview' | 'emailWeeklyDigest' | 'emailAnomaly';

export const NOTIFICATION_PREF_KEYS: NotificationPrefKey[] = [
  'emailCreativeReview',
  'emailWeeklyDigest',
  'emailAnomaly',
];

export function prefEnabled(
  prefs: Record<string, unknown> | null | undefined,
  key: NotificationPrefKey,
): boolean {
  if (!prefs) return true;
  const v = prefs[key];
  return v === undefined || v === null ? true : Boolean(v);
}
