import { fetchRecentActivity } from '../actions/fetchMetrics';
import { GlassCard } from '@/components/shared/GlassCard';
import { BarChart3, Clapperboard, Globe, Shield, Activity } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/format';
import type { ActivityItem } from '../types';

const typeConfig: Record<ActivityItem['type'], { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  campaign: { icon: BarChart3,    color: 'text-indigo-400 bg-indigo-500/10' },
  creative: { icon: Clapperboard, color: 'text-pink-400 bg-pink-500/10' },
  report:   { icon: Globe,        color: 'text-cyan-400 bg-cyan-500/10' },
  brand:    { icon: Shield,       color: 'text-violet-400 bg-violet-500/10' },
  system:   { icon: Activity,     color: 'text-white/40 bg-white/[0.06]' },
};

export async function RecentActivity({ companyId }: { companyId: string }) {
  const activity = await fetchRecentActivity(companyId);

  return (
    <GlassCard padding="none">
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white/80">Activity Feed</h3>
      </div>

      {activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-6">
          <Activity className="w-8 h-8 text-white/10" />
          <p className="text-sm text-white/30">No activity yet</p>
          <p className="text-xs text-white/20">Actions across Creative Studio, Performance Hub and Strategy will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {activity.map((item) => {
            const { icon: Icon, color } = typeConfig[item.type] ?? typeConfig.system;
            return (
              <div key={item.id} className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70 leading-snug">{item.description}</p>
                </div>
                <span className="text-[11px] text-white/25 shrink-0 mt-0.5">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
