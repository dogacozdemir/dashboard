export type AssetStatus = 'pending' | 'approved' | 'revision';
export type AssetType = 'image' | 'video';

export interface CreativeAsset {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  type: AssetType;
  status: AssetStatus;
  uploadedBy: string;
  platform: 'meta' | 'google' | 'tiktok' | 'instagram' | 'linkedin' | 'x' | null;
  caption: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  socialPostEventId: string | null;
  createdAt: string;
}

// ── Shared ──────────────────────────────────────────────────────────────────

export interface RevisionReference {
  url:         string;
  description: string;
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
  revisionType: ImageRevisionType;
  area?:        string;   // free-text: "sağ alt logo", "başlık metni"
  references?:  RevisionReference[];
}

// ── Revision record ──────────────────────────────────────────────────────────

export interface Revision {
  id:            string;
  assetId:       string;
  comment:       string;
  createdBy:     string;
  createdAt:     string;
  videoMetadata: VideoRevisionMeta | null;
  imageMetadata: ImageRevisionMeta | null;
}
