import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

/**
 * Vision provider for creative review.
 *
 * MonoAI's conversational layer runs on DeepSeek, which is text-only — it can
 * read a creative's title and comments but has never been able to see the
 * artwork. That is the one gap that matters most for a creative agency, so
 * image critique runs on a vision-capable model instead.
 *
 * Absent `ANTHROPIC_API_KEY` this is a no-op, matching how e-mail and push
 * degrade in this codebase: the feature hides itself rather than erroring.
 */

/** Haiku's vision edge cap — larger images are downscaled before upload. */
export const MAX_IMAGE_EDGE_PX = 1568;

/** Guard against sending a huge file: Claude rejects images over ~5MB base64. */
export const MAX_IMAGE_BYTES = 4_500_000;

export type VisionMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export function isVisionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Which model critiques the artwork. Defaults to Haiku 4.5 — vision-capable and
 * ~5× cheaper than Opus per review, which is plenty for judging a creative's
 * design. Override with VISION_MODEL to trade cost for depth (e.g. claude-opus-4-8).
 */
export function visionModel(): string {
  return process.env.VISION_MODEL?.trim() || 'claude-haiku-4-5';
}

let client: Anthropic | null = null;

/** Returns null when unconfigured so callers can degrade instead of throwing. */
export function getVisionClient(): Anthropic | null {
  if (!isVisionConfigured()) return null;
  if (!client) client = new Anthropic();
  return client;
}

/** Maps a stored file extension onto a media type Claude accepts. */
export function mediaTypeForUrl(url: string): VisionMediaType | null {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

export interface FetchedImage {
  base64: string;
  mediaType: VisionMediaType;
}

/**
 * Downloads a creative slide so it can be sent inline. Presigned S3 URLs would
 * also work as `source.type: 'url'`, but they expire — inlining keeps the call
 * self-contained and avoids handing a signed URL to a third party.
 */
export async function fetchImageForVision(url: string): Promise<FetchedImage | null> {
  const declared = mediaTypeForUrl(url);

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const header = res.headers.get('content-type')?.split(';')[0]?.trim();
    const mediaType =
      header && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(header)
        ? (header as VisionMediaType)
        : declared;

    if (!mediaType) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;

    return { base64: buffer.toString('base64'), mediaType };
  } catch {
    return null;
  }
}
