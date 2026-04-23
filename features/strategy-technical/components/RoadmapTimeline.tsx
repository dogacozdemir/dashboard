'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, Zap, FileText, Globe, BarChart3, Route } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';
import type { RoadmapItem } from '../types';

const categoryConfig: Record<RoadmapItem['category'], { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  technical:   { icon: Zap,      color: 'text-indigo-400 bg-indigo-500/10' },
  content:     { icon: FileText, color: 'text-cyan-400 bg-cyan-500/10' },
  geo:         { icon: Globe,    color: 'text-violet-400 bg-violet-500/10' },
  performance: { icon: BarChart3, color: 'text-emerald-400 bg-emerald-500/10' },
};

const statusConfig: Record<RoadmapItem['status'], { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  completed:   { icon: CheckCircle2, color: 'text-emerald-400', label: 'Completed' },
  'in-progress':{ icon: Clock,       color: 'text-indigo-400',  label: 'In Progress' },
  upcoming:    { icon: Circle,       color: 'text-white/25',    label: 'Upcoming' },
};

interface RoadmapTimelineProps {
  items: RoadmapItem[];
}

export function RoadmapTimeline({ items }: RoadmapTimelineProps) {
  if (items.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-4 py-10 text-center border border-dashed border-white/[0.08]" padding="lg">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
          <Route className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/60">No roadmap items yet</p>
          <p className="text-xs text-white/25 mt-1">Milestones added by your Madmonos team will appear here</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="none">
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white/80">Technical Roadmap</h3>
        <p className="text-xs text-white/30 mt-0.5">Engineering capacity delivery timeline</p>
      </div>

      <div className="p-6 space-y-1">
        {items.map((item, i) => {
          const category = categoryConfig[item.category];
          const status   = statusConfig[item.status];
          const CatIcon  = category.icon;
          const StatusIcon = status.icon;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-4 py-4 group"
            >
              {/* Timeline connector */}
              <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                <StatusIcon className={cn('w-4 h-4 shrink-0', status.color)} />
                {i < items.length - 1 && (
                  <div className="w-px flex-1 bg-white/[0.06] min-h-[24px]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-1 pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', category.color)}>
                      <CatIcon className="w-3 h-3" />
                    </div>
                    <p className={cn(
                      'text-sm font-medium',
                      item.status === 'upcoming' ? 'text-white/40' : 'text-white/80'
                    )}>
                      {item.title}
                    </p>
                  </div>
                  <span className="text-[10px] text-white/25 shrink-0 mt-0.5 font-medium">
                    {item.eta}
                  </span>
                </div>
                <p className="text-xs text-white/35 leading-relaxed pl-8">{item.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
}
