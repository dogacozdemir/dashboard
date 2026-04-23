'use client';

import { motion } from 'framer-motion';
import { Trophy, Flame, Zap } from 'lucide-react';
import { getLevel } from '../lib/definitions';
import type { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

const RANK_STYLES = [
  { bg: 'bg-amber-500/15 border-amber-500/25',   text: 'text-amber-400',   emoji: '🥇' },
  { bg: 'bg-white/[0.07] border-white/[0.08]',   text: 'text-white/50',    emoji: '🥈' },
  { bg: 'bg-orange-500/10 border-orange-500/20',  text: 'text-orange-400',  emoji: '🥉' },
];

const LEVEL_COLORS: Record<number, string> = {
  1: 'text-white/40',
  2: 'text-indigo-400',
  3: 'text-cyan-400',
  4: 'text-violet-400',
  5: 'text-amber-400',
  6: 'text-emerald-400',
};

export function Leaderboard({ entries, currentUserId }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 text-center">
        <p className="text-sm text-white/30">Henüz sıralama yok</p>
        <p className="text-xs text-white/20 mt-1">Aktivite biriktikçe burada görünecek</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white/80">Sıralama</h3>
          <p className="text-[10px] text-white/30">XP&apos;e göre</p>
        </div>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {entries.map((entry, i) => {
          const rankStyle  = RANK_STYLES[i] ?? null;
          const isMe       = entry.userId === currentUserId;
          const lvl        = getLevel(entry.totalXP);
          const lvlColor   = LEVEL_COLORS[lvl.level] ?? LEVEL_COLORS[1];

          return (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                isMe ? 'bg-indigo-500/[0.08]' : 'hover:bg-white/[0.02]'
              }`}
            >
              {/* Rank */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                rankStyle ? `border ${rankStyle.bg}` : 'bg-white/[0.04] border border-white/[0.05]'
              }`}>
                {rankStyle ? rankStyle.emoji : (
                  <span className="text-[11px] font-bold text-white/30">{i + 1}</span>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-semibold truncate ${isMe ? 'text-indigo-300' : 'text-white/75'}`}>
                    {entry.displayName}
                  </span>
                  {isMe && (
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded-full">
                      Sen
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-semibold ${lvlColor}`}>
                    Lv.{lvl.level} {lvl.title}
                  </span>
                  <span className="text-[10px] text-white/20">·</span>
                  <span className="text-[10px] text-white/30">{entry.badgeCount} rozet</span>
                </div>
              </div>

              {/* Streak */}
              {entry.currentStreak > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span className="text-xs font-bold text-orange-400 tabular-nums">
                    {entry.currentStreak}
                  </span>
                </div>
              )}

              {/* XP */}
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="text-sm font-black tabular-nums text-white/80">
                    {entry.totalXP.toLocaleString('tr-TR')}
                  </span>
                </div>
                <span className="text-[9px] text-white/25">XP</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
