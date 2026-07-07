import type { CreativeContentFormat } from '@/features/creative-studio/types';

export type MilestoneCategory = 'technical' | 'content' | 'geo' | 'performance';
export type MilestoneStatus   = 'completed' | 'in-progress' | 'upcoming';
export type CalendarEventType = 'strategy_call' | 'social_post';
export type SocialPlatform    = 'meta' | 'google' | 'tiktok' | 'instagram' | 'linkedin' | 'x';

export type { CreativeContentFormat };

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
  /** Linked creative **post** (carousel or single). */
  creativePostId: string | null;
  creativeTitle: string | null;
  creativeUrl: string | null;
  /** From linked creative_posts.content_format — social dots / legend in Social mode. */
  contentFormat?: CreativeContentFormat | null;
  status: 'scheduled' | 'done' | 'cancelled';
  createdAt: string;
}

export interface DayItem {
  type: 'milestone' | 'strategy_call' | 'social_post';
  id: string;
  title: string;
  color: 'indigo' | 'cyan' | 'violet' | 'emerald' | 'amber';
  /** Populated for social_post when calendar JOIN returns creative format. */
  contentFormat?: CreativeContentFormat | null;
  data: CalendarMilestone | CalendarEvent;
}
