'use server';

import { getPremiumActionError } from '@/lib/copy/premium-copy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { auth } from '@/lib/auth/config';
import { trackActivity } from '@/features/gamification/actions/trackActivity';
import type {
  CalendarMilestone,
  CalendarEvent,
  SocialPlatform,
  CreativeContentFormat,
} from '../types';
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

  // PostgREST: two FKs link these tables (creative_post_id on events ↔ social_post_event_id on posts).
  // Must disambiguate the embed with the FK from calendar_events → creative_posts.
  const { data, error } = await supabase
    .from('calendar_events')
    .select(`
      id, event_type, title, description, event_date, event_time,
      duration_min, meeting_url, platform, caption, creative_post_id,
      creative_posts!calendar_events_creative_post_id_fkey (
        id, title, thumbnail_url, content_format,
        creative_assets ( url, thumbnail_url, slide_index )
      ),
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
    const rawPost = r.creative_posts as unknown;
    const post = (Array.isArray(rawPost) ? rawPost[0] : rawPost) as {
      id: string;
      title: string;
      thumbnail_url: string | null;
      content_format: CreativeContentFormat | null;
      creative_assets: Array<{ url: string; thumbnail_url: string | null; slide_index: number }> | null;
    } | null | undefined;

    let creativeUrl: string | null = post?.thumbnail_url ?? null;
    const slides = [...(post?.creative_assets ?? [])].sort((a, b) => a.slide_index - b.slide_index);
    if (!creativeUrl && slides[0]) {
      creativeUrl = slides[0].thumbnail_url ?? slides[0].url ?? null;
    }

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
      creativePostId: (r.creative_post_id as string | null) ?? null,
      creativeTitle: post?.title ?? null,
      creativeUrl,
      contentFormat:
        r.event_type === 'social_post'
          ? (post?.content_format as CreativeContentFormat | null | undefined) ?? 'feed_post'
          : null,
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
    creativePostId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    const { premiumSessionRequiredMessage } = await import('@/lib/i18n/premium-action-errors');
    return { success: false, error: await premiumSessionRequiredMessage() };
  }

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
    creative_post_id: input.creativePostId ?? null,
    created_by:  user.id,
  });

  if (error) {
    console.error('[createCalendarEvent]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }

  try {
    await trackActivity('calendar_event_created');
  } catch (e) {
    console.error('[trackActivity calendar_event_created]', e);
  }

  return { success: true };
}

export async function fetchCreativesForCalendar(
  companyId: string,
): Promise<Array<{ id: string; title: string; contentFormat: CreativeContentFormat | null }>> {
  const validatedId = await requireTenantAction(companyId);
  const supabase    = await createSupabaseServerClient();
  const { data }    = await supabase
    .from('creative_posts')
    .select('id, title, content_format')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title ?? '',
    contentFormat:
      (((r as { content_format?: string }).content_format as CreativeContentFormat | null | undefined) ?? null),
  }));
}
