import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publishBadgeKey } from '@/features/creative-studio/components/PublishBadge';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

const publisher = read('features/oauth/actions/publishInstagramPost.ts');
const cron = read('app/api/cron/publish-scheduled/route.ts');
const hybridFeed = read('features/oauth/actions/fetchInstagramHybridFeed.ts');
const migration = read('supabase/migrations/20260713090000_instagram_publishing.sql');

/**
 * Publishing is the one irreversible, outward-facing action in the product:
 * a double-post cannot be undone from inside the app. These tests pin the
 * guards that make that impossible.
 */
describe('double-publish protection', () => {
  it('refuses a post that already carries an Instagram media id', () => {
    expect(publisher).toContain("post.publish_state === 'published' || post.ig_media_id");
    expect(publisher).toContain("errorKey: 'already_published'");
  });

  it('claims the row before calling the Graph API', () => {
    // The claim is a conditional UPDATE — two concurrent runs cannot both win.
    const claim = publisher.slice(publisher.indexOf('Claim the row'), publisher.indexOf('const fail ='));
    expect(claim).toContain("publish_state: 'publishing'");
    expect(claim).toContain("in('publish_state', ['idle', 'queued', 'failed'])");
    expect(claim).toContain('.select(');
  });

  it('bails out when the claim is not won', () => {
    expect(publisher).toContain("errorKey: 'publish_in_progress'");
  });

  it('enforces one media id per post at the database level', () => {
    expect(migration).toContain('idx_creative_posts_ig_media_id');
    expect(migration).toMatch(/create unique index[\s\S]{0,120}ig_media_id/);
  });

  it('never leaves a row stuck in the publishing state', () => {
    // Every exit past the claim must go through fail() or succeed().
    const body = publisher.slice(publisher.indexOf('const rawSlides'));
    const rawReturns = body.match(/return \{\s*success: false/g) ?? [];
    expect(rawReturns).toHaveLength(0);
  });
});

describe('publish outcome is recorded', () => {
  it('writes the media id and timestamp on success', () => {
    expect(publisher).toContain("publish_state: 'published'");
    expect(publisher).toContain('ig_media_id: instagramMediaId');
    expect(publisher).toContain('published_at:');
  });

  it('writes the error on failure', () => {
    expect(publisher).toContain("publish_state: 'failed'");
    expect(publisher).toContain('publish_error: error.slice(0, 500)');
  });
});

describe('scheduled publisher safety', () => {
  it('only runs for tenants that opted in', () => {
    expect(cron).toContain("eq('auto_publish_instagram', true)");
    expect(migration).toContain('auto_publish_instagram boolean not null default false');
  });

  it('never publishes for a demo tenant', () => {
    expect(cron).toContain('is_demo');
    expect(cron).toMatch(/filter\([\s\S]{0,80}is_demo/);
  });

  it('only considers approved Instagram posts that never went live', () => {
    expect(cron).toContain("eq('status', 'approved')");
    expect(cron).toContain("eq('platform', 'instagram')");
    expect(cron).toContain("is('ig_media_id', null)");
  });

  it('gives up after a bounded number of attempts', () => {
    expect(cron).toContain('MAX_ATTEMPTS');
    expect(cron).toMatch(/publish_attempts[\s\S]{0,40}< MAX_ATTEMPTS/);
  });

  it('requires the cron bearer token', () => {
    expect(cron).toContain('CRON_SECRET');
    expect(cron).toContain('status: 401');
  });
});

describe('due-time calculation', () => {
  /** Mirrors the cron's isDue so the boundary behaviour is assertable. */
  function isDue(
    post: { scheduled_date: string | null; scheduled_time: string | null },
    now: Date,
  ): boolean {
    if (!post.scheduled_date) return false;
    const time = post.scheduled_time?.slice(0, 5) ?? '00:00';
    const due = new Date(`${post.scheduled_date}T${time}:00`);
    return !Number.isNaN(due.getTime()) && due.getTime() <= now.getTime();
  }

  const now = new Date('2026-07-21T12:00:00');

  it('publishes a slot that has passed', () => {
    expect(isDue({ scheduled_date: '2026-07-21', scheduled_time: '11:00' }, now)).toBe(true);
  });

  it('holds a slot still in the future', () => {
    expect(isDue({ scheduled_date: '2026-07-21', scheduled_time: '13:00' }, now)).toBe(false);
  });

  it('treats the exact minute as due', () => {
    expect(isDue({ scheduled_date: '2026-07-21', scheduled_time: '12:00' }, now)).toBe(true);
  });

  it('defaults a missing time to midnight', () => {
    expect(isDue({ scheduled_date: '2026-07-21', scheduled_time: null }, now)).toBe(true);
    expect(isDue({ scheduled_date: '2026-07-22', scheduled_time: null }, now)).toBe(false);
  });

  it('never publishes a post with no date', () => {
    expect(isDue({ scheduled_date: null, scheduled_time: '09:00' }, now)).toBe(false);
  });

  it('tolerates seconds in a stored time value', () => {
    expect(isDue({ scheduled_date: '2026-07-21', scheduled_time: '11:30:00' }, now)).toBe(true);
  });
});

describe('simulator de-duplication', () => {
  it('drops the local copy of a post that is already in the live feed', () => {
    // Otherwise a published post renders twice: once as plan, once as reality.
    expect(hybridFeed).toContain('const liveMediaIds = new Set(');
    expect(hybridFeed).toContain('liveMediaIds.has(p.igMediaId)');
  });

  it('marks everything from the Graph API as already published', () => {
    expect(hybridFeed).toContain("publishState: 'published'");
    expect(hybridFeed).toContain('igMediaId: item.id');
  });

  it('persists discovered credentials so the publisher can authenticate', () => {
    // The publisher reads meta_publishing_accounts exclusively — nothing wrote it.
    expect(hybridFeed).toContain('persistPublishingAccount');
    expect(hybridFeed).toContain("from('meta_publishing_accounts').upsert");
  });
});

describe('publish badge state mapping', () => {
  it('shows nothing for a post that was never scheduled', () => {
    expect(publishBadgeKey('idle', false)).toBeNull();
  });

  it('reads an approved future post as scheduled', () => {
    expect(publishBadgeKey('idle', true)).toBe('scheduled');
  });

  it('maps each lifecycle state to its own badge', () => {
    expect(publishBadgeKey('queued', true)).toBe('queued');
    expect(publishBadgeKey('publishing', true)).toBe('publishing');
    expect(publishBadgeKey('published', true)).toBe('published');
    expect(publishBadgeKey('failed', true)).toBe('failed');
  });

  it('keeps the live badge even if the schedule was cleared', () => {
    expect(publishBadgeKey('published', false)).toBe('published');
  });
});

describe('OAuth scope', () => {
  it('requests the permission media_publish needs', () => {
    const meta = read('app/api/oauth/meta/route.ts');
    expect(meta).toContain('instagram_content_publish');
  });
});
