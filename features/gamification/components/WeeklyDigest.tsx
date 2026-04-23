import { CheckCircle2, RotateCcw, Zap, MessageSquare, Calendar, Trophy } from 'lucide-react';
import type { WeeklyDigestData } from '../types';

interface WeeklyDigestProps {
  data: WeeklyDigestData;
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return (
    <span className="text-[10px] font-bold text-emerald-400">✦ İlk hafta</span>
  );
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="text-[10px] text-white/25">Değişmedi</span>;
  return (
    <span className={`text-[10px] font-bold ${pct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
      {pct > 0 ? '↑' : '↓'} %{Math.abs(pct)}
    </span>
  );
}

const STATS = (d: WeeklyDigestData) => [
  {
    icon:  CheckCircle2,
    color: 'emerald',
    label: 'Onaylanan',
    value: d.approvalsThisWeek,
    trend: <TrendBadge current={d.approvalsThisWeek} previous={d.approvalsLastWeek} />,
  },
  {
    icon:  RotateCcw,
    color: 'amber',
    label: 'Revizyon',
    value: d.revisionsThisWeek,
    trend: null,
  },
  {
    icon:  MessageSquare,
    color: 'violet',
    label: 'AI Mesaj',
    value: d.aiMessagesThisWeek,
    trend: null,
  },
  {
    icon:  Calendar,
    color: 'cyan',
    label: 'Aktif Gün',
    value: d.activeDaysThisWeek,
    trend: null,
  },
  {
    icon:  Trophy,
    color: 'amber',
    label: 'Yeni Rozet',
    value: d.newAchievements,
    trend: null,
  },
];

const ICON_BG: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400',
  amber:   'bg-amber-500/15 text-amber-400',
  violet:  'bg-violet-500/15 text-violet-400',
  cyan:    'bg-cyan-500/15 text-cyan-400',
};

export function WeeklyDigest({ data }: WeeklyDigestProps) {
  const stats = STATS(data);
  const hasActivity = stats.some((s) => s.value > 0);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-500/[0.07] to-violet-500/[0.04] border border-indigo-500/15 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white/80">Haftalık Özet</h3>
          <p className="text-[10px] text-white/30">Bu hafta yapılanlar</p>
        </div>
      </div>

      {!hasActivity ? (
        <p className="text-xs text-white/30 text-center py-4">
          Bu hafta henüz aktivite yok
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:grid-cols-5">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-xl bg-white/[0.04] border border-white/[0.05] p-3 space-y-1.5"
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${ICON_BG[s.color]}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <p className="text-xl font-black text-white/85 tabular-nums leading-none">
                  {s.value}
                </p>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-white/35">{s.label}</p>
                  {s.trend}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
