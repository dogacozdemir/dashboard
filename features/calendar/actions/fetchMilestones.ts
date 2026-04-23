'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { auth } from '@/lib/auth/config';
import type { CalendarMilestone, CalendarEvent, SocialPlatform } from '../types';
import type { SessionUser } from '@/types/user';

export async function fetchCalendarMilestones(companyId: string): Promise<CalendarMilestone[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('roadmap_milestones')
    .select('id, title, description, status, category, eta, eta_date, created_at')
    .eq('tenant_id', validatedId)
    .order('eta_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('[fetchCalendarMilestones]', error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id:          r.id,
    title:       r.title,
    description: r.description,
    status:      r.status as CalendarMilestone['status'],
    category:    r.category as CalendarMilestone['category'],
    eta:         r.eta,
    etaDate:     r.eta_date,
    createdAt:   r.created_at,
  }));
}

export async function fetchCalendarEvents(companyId: string): Promise<CalendarEvent[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('calendar_events')
    .select(`
      id, event_type, title, description, event_date, event_time,
      duration_min, meeting_url, platform, caption, creative_id,
      creative_assets!calendar_events_creative_id_fkey (title, url),
      status, created_at
    `)
    .eq('tenant_id', validatedId)
    .neq('status', 'cancelled')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('[fetchCalendarEvents]', error.message);
    return [];
  }

  return (data ?? []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creative = r.creative_assets as any;
    return {
      id:            r.id,
      eventType:     r.event_type as CalendarEvent['eventType'],
      title:         r.title,
      description:   r.description,
      eventDate:     r.event_date,
      eventTime:     r.event_time,
      durationMin:   r.duration_min,
      meetingUrl:    r.meeting_url,
      platform:      r.platform as SocialPlatform | null,
      caption:       r.caption,
      creativeId:    r.creative_id,
      creativeTitle: creative?.title ?? null,
      creativeUrl:   creative?.url ?? null,
      status:        r.status as CalendarEvent['status'],
      createdAt:     r.created_at,
    };
  });
}

export async function createCalendarEvent(
  companyId: string,
  input: {
    eventType: 'strategy_call' | 'social_post';
    title: string;
    description?: string;
    eventDate: string;
    eventTime?: string;
    durationMin?: number;
    meetingUrl?: string;
    platform?: SocialPlatform;
    caption?: string;
    creativeId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: 'Unauthorized' };

  const user        = session.user as SessionUser;
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();

  const { error } = await supabase.from('calendar_events').insert({
    tenant_id:   validatedId,
    event_type:  input.eventType,
    title:       input.title,
    description: input.description ?? null,
    event_date:  input.eventDate,
    event_time:  input.eventTime ?? null,
    duration_min: input.durationMin ?? null,
    meeting_url: input.meetingUrl ?? null,
    platform:    input.platform ?? null,
    caption:     input.caption ?? null,
    creative_id: input.creativeId ?? null,
    created_by:  user.id,
  });

  if (error) {
    console.error('[createCalendarEvent]', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function fetchCreativesForCalendar(companyId: string) {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();
  const { data }    = await supabase
    .from('creative_assets')
    .select('id, title')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
}
