import { describe, it, expect } from 'vitest';
import { prefEnabled, NOTIFICATION_PREF_KEYS } from '@/lib/notifications/prefs';

/**
 * Opt-out model: a user who has never touched their settings must still receive
 * mail. Getting this backwards silently mutes every notification in the product.
 */
describe('prefEnabled', () => {
  it('defaults to enabled when the user has no prefs row', () => {
    expect(prefEnabled(null, 'emailWeeklyDigest')).toBe(true);
    expect(prefEnabled(undefined, 'emailWeeklyDigest')).toBe(true);
  });

  it('defaults to enabled when the key was never set', () => {
    expect(prefEnabled({}, 'emailAnomaly')).toBe(true);
    expect(prefEnabled({ emailWeeklyDigest: false }, 'emailAnomaly')).toBe(true);
  });

  it('honours an explicit opt-out', () => {
    expect(prefEnabled({ emailAnomaly: false }, 'emailAnomaly')).toBe(false);
  });

  it('treats an explicit null as enabled, not opted out', () => {
    expect(prefEnabled({ emailAnomaly: null }, 'emailAnomaly')).toBe(true);
  });

  it('honours an explicit opt-in', () => {
    expect(prefEnabled({ emailCreativeReview: true }, 'emailCreativeReview')).toBe(true);
  });

  it('covers every key the settings UI exposes', () => {
    for (const key of NOTIFICATION_PREF_KEYS) {
      expect(prefEnabled({ [key]: false }, key)).toBe(false);
      expect(prefEnabled({}, key)).toBe(true);
    }
  });
});
