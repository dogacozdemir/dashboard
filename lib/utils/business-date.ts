/**
 * Business-timezone calendar date as `YYYY-MM-DD`.
 *
 * Day-boundary logic (streaks, "today") must not use UTC: a user logging in just
 * after local midnight would otherwise be counted on the previous UTC day and
 * break their streak. The product's primary market is Turkey (Europe/Istanbul,
 * fixed UTC+3, no DST since 2016), so that is the default boundary.
 */
const BUSINESS_TZ = 'Europe/Istanbul';

export function businessDateString(date: Date = new Date(), timeZone: string = BUSINESS_TZ): string {
  // 'en-CA' locale formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
