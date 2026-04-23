export type MilestoneCategory = 'technical' | 'content' | 'geo' | 'performance';
export type MilestoneStatus   = 'completed' | 'in-progress' | 'upcoming';
export type CalendarEventType = 'strategy_call' | 'social_post';
export type SocialPlatform    = 'meta' | 'google' | 'tiktok' | 'instagram' | 'linkedin' | 'x';

export interface CalendarMilestone {
  id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  category: MilestoneCategory;
  eta: string | null;
  etaDate: string | null;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  eventType: CalendarEventType;
  title: string;
  description: string | null;
  eventDate: string;
  eventTime: string | null;
  durationMin: number | null;
  meetingUrl: string | null;
  platform: SocialPlatform | null;
  caption: string | null;
  creativeId: string | null;
  creativeTitle: string | null;
  creativeUrl: string | null;
  status: 'scheduled' | 'done' | 'cancelled';
  createdAt: string;
}

export interface DayItem {
  type: 'milestone' | 'strategy_call' | 'social_post';
  id: string;
  title: string;
  color: 'indigo' | 'cyan' | 'violet' | 'emerald' | 'amber';
  data: CalendarMilestone | CalendarEvent;
}
