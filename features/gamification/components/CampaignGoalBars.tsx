'use client';

import { motion } from 'framer-motion';
import { formatNumber, formatCurrency } from '@/lib/utils/format';

interface GoalBarProps {
  label:    string;
  current:  number;
  goal:     number;
  format?:  'number' | 'currency';
  color:    string;
}

const BAR_COLORS: Record<string, string> = {
  cyan:    'from-cyan-500 to-cyan-400',
  indigo:  'from-indigo-500 to-indigo-400',
  emerald: 'from-emerald-500 to-emerald-400',
};

function GoalBar({ label, current, goal, format = 'number', color }: GoalBarProps) {
  const pct    = Math.min(100, goal > 0 ? Math.round((current / goal) * 100) : 0);
  const done   = pct >= 100;
  const fmt    = (v: number) => format === 'currency' ? formatCurrency(v) : formatNumber(v);
  const gradient = BAR_COLORS[color] ?? BAR_COLORS.cyan;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/40">{label}</span>
        <span className={`font-semibold tabular-nums ${done ? 'text-emerald-400' : 'text-white/50'}`}>
          {fmt(current)} / {fmt(goal)}
          {done && ' ✓'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

export interface CampaignGoals {
  goalImpressions: number | null;
  goalClicks:      number | null;
  goalSpend:       number | null;
}

interface CampaignGoalBarsProps {
  impressions: number;
  clicks:      number;
  spend:       number;
  goals:       CampaignGoals;
}

export function CampaignGoalBars({ impressions, clicks, spend, goals }: CampaignGoalBarsProps) {
  const hasGoals = goals.goalImpressions || goals.goalClicks || goals.goalSpend;
  if (!hasGoals) return null;

  return (
    <div className="space-y-2 pt-1">
      {goals.goalImpressions != null && (
        <GoalBar label="Görüntülenme" current={impressions} goal={goals.goalImpressions} color="cyan" />
      )}
      {goals.goalClicks != null && (
        <GoalBar label="Tıklama" current={clicks} goal={goals.goalClicks} color="indigo" />
      )}
      {goals.goalSpend != null && (
        <GoalBar label="Harcama" current={spend} goal={goals.goalSpend} format="currency" color="emerald" />
      )}
    </div>
  );
}
