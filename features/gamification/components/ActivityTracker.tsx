'use client';

import { useEffect, useRef } from 'react';
import { trackActivity } from '../actions/trackActivity';
import { ACHIEVEMENT_MAP } from '../lib/definitions';
import { triggerAchievementToast } from './CelebrationOverlay';

// Fires once per browser session — tracks login streak + checks achievements
export function ActivityTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    void trackActivity('login').then(({ newAchievements }) => {
      newAchievements.forEach((key, i) => {
        const def = ACHIEVEMENT_MAP.get(key);
        if (!def) return;
        setTimeout(() => {
          triggerAchievementToast({ icon: def.icon, title: def.title, desc: def.desc, xp: def.xp });
        }, i * 800);
      });
    });
  }, []);

  return null;
}
