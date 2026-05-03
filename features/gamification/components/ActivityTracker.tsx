'use client';

import { useEffect, useRef } from 'react';
import { trackActivity } from '../actions/trackActivity';
import { ACHIEVEMENT_MAP } from '../lib/definitions';
import { triggerAchievementToast, triggerLevelUp } from './CelebrationOverlay';

// Fires once per browser session — tracks login streak + XP + achievements
export function ActivityTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    void trackActivity('login').then((result) => {
      result.newAchievements.forEach((key, i) => {
        const def = ACHIEVEMENT_MAP.get(key);
        if (!def) return;
        setTimeout(() => {
          triggerAchievementToast({ icon: def.icon, achievementKey: key, xp: def.xp });
        }, i * 800);
      });
      if (result.leveledUp) {
        setTimeout(
          () => triggerLevelUp(result.leveledUp!),
          result.newAchievements.length * 800 + 500,
        );
      }
    });
  }, []);

  return null;
}
