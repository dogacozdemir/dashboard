export type AssetStatus = 'pending' | 'approved' | 'revision';
export type AssetType = 'image' | 'video';

/** Scheduled social creative shape — drives Ops Calendar social-mode dots & legend. */
export type CreativeContentFormat = 'feed_post' | 'carousel' | 'reel' | 'story';

export type CreativePlatform = 'meta' | 'google' | 'tiktok' | 'instagram' | 'linkedin' | 'x' | null;

/** One media file inside a carousel post. */
export interface CreativeSlide {
  id: string;
  slideIndex: number;
  /** Per-slide label (often file-derived). */
  title: string;
  url: string;
  thumbnailUrl: string | null;
  type: AssetType;
  createdAt: string;
}

/** Parent entity: one scheduled social / creative review unit (single or carousel). */
export interface CreativePost {
  id: string;
  title: string;
  caption: string | null;
  platform: CreativePlatform;
  contentFormat: CreativeContentFormat;
  status: AssetStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  socialPostEventId: string | null;
  /** Poster frame for grid + calendar (typically first slide). */
  posterThumbnailUrl: string | null;
  uploadedBy: string;
  createdAt: string;
  slides: CreativeSlide[];
  /** Instagram publishing lifecycle — see `creative_posts.publish_state`. */
  publishState: PublishState;
  publishedAt: string | null;
  /** Set once live on Instagram; also de-duplicates against the live feed. */
  igMediaId: string | null;
  publishError: string | null;
}

export type PublishState = 'idle' | 'queued' | 'publishing' | 'published' | 'failed';

/** Live Instagram Business profile metrics from Meta Graph API. */
export interface InstagramLiveProfile {
  connected: boolean;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  /** Real account bio from the Graph API (business/creator accounts). */
  biography: string | null;
  /** Website set on the Instagram profile — preferred over the tenant domain. */
  website: string | null;
}

/** Creative post in the hybrid simulator feed (live API + scheduled DB). */
export interface HybridFeedPost extends CreativePost {
  feedSource: 'live' | 'scheduled';
  /** ISO timestamp used for chronological merge + simulation visibility. */
  sortAt: string;
  /** Real like count from the Graph API — null for scheduled (not yet live) posts. */
  likeCount?: number | null;
  /** Real comment count from the Graph API — null for scheduled posts. */
  commentsCount?: number | null;
}

// ── Shared ──────────────────────────────────────────────────────────────────

export interface RevisionReference {
  url:         string;
  description: string;
}

/** A point annotation placed on a specific image slide (percent-based, responsive). */
export interface RevisionPin {
  /** Horizontal position as 0–100 percent of the rendered image width. */
  xPct:       number;
  /** Vertical position as 0–100 percent of the rendered image height. */
  yPct:       number;
  note:       string;
  /** `creative_assets.slide_index` the pin belongs to. */
  slideIndex: number;
}

// ── Video ────────────────────────────────────────────────────────────────────

export type VideoRevisionType = 'full' | 'time_range' | 'audio' | 'text' | 'color';

export interface VideoRevisionMeta {
  revisionType: VideoRevisionType;
  startTime?:   string;   // "MM:SS"
  endTime?:     string;   // "MM:SS"
  references?:  RevisionReference[];
}

// ── Image ────────────────────────────────────────────────────────────────────

export type ImageRevisionType =
  | 'general'
  | 'color_tone'
  | 'text_typography'
  | 'composition'
  | 'background'
  | 'subject';

export interface ImageRevisionMeta {
  /** Legacy single-select revisions (before multi-aspect notes). */
  revisionType?: ImageRevisionType;
  area?: string;
  /** Only non-empty fields are stored; each key is a separate instruction. */
  aspectNotes?: Partial<Record<ImageRevisionType, string>>;
  references?: RevisionReference[];
  /** Visual point annotations placed directly on the image. */
  pins?: RevisionPin[];
}

// ── Revision record ──────────────────────────────────────────────────────────

export interface Revision {
  id:            string;
  assetId:       string;
  /** Aligns with `creative_assets.slide_index`; null = whole post. */
  slideIndex:    number | null;
  comment:       string;
  /** Human-readable author name (falls back to email/UUID). */
  createdBy:     string;
  /** Author `auth.users` id — used for edit/delete permission checks. */
  createdById:   string;
  createdAt:     string;
  updatedAt:     string | null;
  /** Set when a reviewer marks the revision resolved. */
  resolvedAt:    string | null;
  /** Human-readable name of whoever resolved it. */
  resolvedBy:    string | null;
  videoMetadata: VideoRevisionMeta | null;
  imageMetadata: ImageRevisionMeta | null;
}
