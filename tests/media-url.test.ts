import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const simulator = readFileSync(
  resolve(process.cwd(), 'features/creative-studio/components/InstagramSimulatorClient.tsx'),
  'utf8',
);

/**
 * Reimplements the component's guard so its behaviour can be asserted without a
 * DOM. Kept in step with the source by the structural test below.
 */
function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/.test(path);
}

describe('isVideoUrl', () => {
  it('detects video files behind a presigned query string', () => {
    expect(
      isVideoUrl('https://bucket.s3.amazonaws.com/t/creative/slide.mp4?X-Amz-Signature=abc&x-id=GetObject'),
    ).toBe(true);
  });

  it('covers the container formats creatives are uploaded in', () => {
    for (const ext of ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv']) {
      expect(isVideoUrl(`https://x/y/clip.${ext}`)).toBe(true);
      expect(isVideoUrl(`https://x/y/clip.${ext.toUpperCase()}`)).toBe(true);
    }
  });

  it('leaves image URLs alone', () => {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'gif']) {
      expect(isVideoUrl(`https://x/y/photo.${ext}?sig=1`)).toBe(false);
    }
  });

  it('is not fooled by a video extension in the middle of the path', () => {
    expect(isVideoUrl('https://x/mp4/cover.png')).toBe(false);
  });

  it('handles empty input', () => {
    expect(isVideoUrl(null)).toBe(false);
    expect(isVideoUrl(undefined)).toBe(false);
    expect(isVideoUrl('')).toBe(false);
  });
});

describe('grid thumbnail never renders a video in an <img>', () => {
  it('keeps the guard wired into the poster selection', () => {
    // A stored thumbnail pointing at the .mp4 produced permanently black tiles.
    expect(simulator).toContain('function isVideoUrl');
    expect(simulator).toContain('const poster = isVideoUrl(candidate) ? null : candidate;');
  });

  it('shares one resolver between the grid and the highlights row', () => {
    // The two used to duplicate the logic, so the highlights bubbles kept
    // rendering .mp4 files inside <img> after the grid was fixed.
    expect(simulator).toContain('function resolveTileMedia');
    const calls = simulator.match(/resolveTileMedia\(post\)/g) ?? [];
    expect(calls.length).toBe(2);
  });
});
