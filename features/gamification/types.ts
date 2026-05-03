export interface UserStreak {
  userId:        string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export interface UserAchievement {
  id:             string;
  userId:         string;
  achievementKey: string;
  earnedAt:       string;
  metadata:       Record<string, unknown> | null;
}

export interface AchievementDef {
  key:   string;
  icon:  string;
  color: string;
  xp:    number;
  secret?: boolean;
}

export interface EarnedAchievement extends AchievementDef {
  earnedAt: string;
}

export interface UserGamificationData {
  streak:       UserStreak;
  achievements: EarnedAchievement[];
  totalXP:      number;
  level:        XPLevel;
}

export interface XPLevel {
  level: number;
  minXP: number;
  maxXP: number | null;
  color: string;
}

export interface WeeklyDigestData {
  approvalsThisWeek:  number;
  approvalsLastWeek:  number;
  revisionsThisWeek:  number;
  aiMessagesThisWeek: number;
  activeDaysThisWeek: number;
  newAchievements:    number;
}

export interface LeaderboardEntry {
  userId:        string;
  displayName:   string;
  currentStreak: number;
  totalXP:       number;
  badgeCount:    number;
  level:         number;
}

export type GamificationEvent =
  | 'login'
  | 'creative_approved'
  | 'creative_uploaded'
  | 'revision_added'
  | 'ai_message_sent'
  | 'pdf_generated'
  | 'brand_asset_uploaded'
  | 'calendar_event_created'
  /** No action XP — evaluates reach_100k from ctx.totalLifetimeImpressions */
  | 'milestone_impressions_check';

export interface GamificationTrackResult {
  newAchievements: string[];
  leveledUp:       { from: number; to: number } | null;
  xpGained:        number;
  totalXP:         number;
}
