type RelativeTimeTranslate = (key: 'justNow' | 'minutes' | 'hours' | 'days', values?: { n: number }) => string;

export function formatRelativeFromMessages(dateString: string, t: RelativeTimeTranslate): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return t('days', { n: days });
  if (hours > 0) return t('hours', { n: hours });
  if (minutes > 0) return t('minutes', { n: minutes });
  return t('justNow');
}
