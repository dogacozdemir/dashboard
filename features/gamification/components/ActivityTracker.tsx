'use client';

import { useEffect, useRef } from 'react';
import { trackActivity } from '../actions/trackActivity';
import { ACHIEVEMENT_MAP } from '../lib/definitions';
import { triggerAchievementToast, triggerLevelUp } from './CelebrationOverlay';

function deferLoginTrack(fn: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => fn(), { timeout: 4000 });
    return;
  }
  window.setTimeout(fn, 250);
}

// Fires once per browser session — tracks login streak + XP + achievements off the critical path.
export function ActivityTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    deferLoginTrack(() => {
      void trackActivity('login').then((result) => {
        result.newAchievements.forEach((key, i) => {
          const def = ACHIEVEMENT_MAP.get(key);
          if (!def) return;
          window.setTimeout(() => {
            triggerAchievementToast({ icon: def.icon, achievementKey: key, xp: def.xp });
          }, i * 800);
        });
        if (result.leveledUp) {
          window.setTimeout(
            () => triggerLevelUp(result.leveledUp!),
            result.newAchievements.length * 800 + 500,
          );
        }
      });
    });
  }, []);

  return null;
}
