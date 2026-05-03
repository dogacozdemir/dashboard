'use client';

import { useEffect } from 'react';
import { ACHIEVEMENT_MAP } from '../lib/definitions';
import type { GamificationTrackResult } from '../types';
import { triggerAchievementToast, triggerLevelUp } from './CelebrationOverlay';

/** Surfaces reach_100k (and any milestone event achievements) after server evaluate on dashboard load. */
export function DashboardImpressionMilestone({ result }: { result: GamificationTrackResult }) {
  const achievementSig = (result.newAchievements ?? []).join(',');
  const levelSig = result.leveledUp ? `${result.leveledUp.from}->${result.leveledUp.to}` : '';

  useEffect(() => {
    const keys = result.newAchievements ?? [];
    if (!keys.length && !result.leveledUp) return;

    try {
      const dedupeKey = `mm.miletoast.v1:${achievementSig}:${levelSig}`;
      if (achievementSig || levelSig) {
        if (sessionStorage.getItem(dedupeKey)) return;
        sessionStorage.setItem(dedupeKey, '1');
      }
    } catch {
      /* ignore quota / private mode */
    }

    keys.forEach((key, i) => {
      const def = ACHIEVEMENT_MAP.get(key);
      if (!def) return;
      setTimeout(() => {
        triggerAchievementToast({ icon: def.icon, achievementKey: key, xp: def.xp });
      }, i * 800);
    });

    if (result.leveledUp) {
      setTimeout(
        () => triggerLevelUp(result.leveledUp!),
        keys.length * 800 + 500,
      );
    }
  }, [achievementSig, levelSig, result.leveledUp, result.newAchievements]);

  return null;
}
