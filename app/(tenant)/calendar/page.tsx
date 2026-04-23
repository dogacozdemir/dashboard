import { requireTenantContext } from '@/lib/auth/tenant-guard';
import {
  fetchCalendarMilestones,
  fetchCalendarEvents,
  fetchCreativesForCalendar,
} from '@/features/calendar/actions/fetchMilestones';
import { MilestoneCalendar } from '@/features/calendar/components/MilestoneCalendar';
import { Calendar } from 'lucide-react';

export default async function CalendarPage() {
  const { companyId, tenant } = await requireTenantContext();

  const [milestones, events, creatives] = await Promise.all([
    fetchCalendarMilestones(companyId),
    fetchCalendarEvents(companyId),
    fetchCreativesForCalendar(companyId),
  ]);

  const totalItems = milestones.length + events.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass glow-inset rounded-2xl p-5 border border-violet-500/10 bg-gradient-to-r from-violet-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/80">Operations Calendar</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Milestones, calls & social posts for <span className="text-violet-300">{tenant.name}</span>
            </p>
          </div>
          <div className="ml-auto text-xs text-white/30">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <MilestoneCalendar
        companyId={companyId}
        milestones={milestones}
        events={events}
        creatives={creatives}
      />
    </div>
  );
}
