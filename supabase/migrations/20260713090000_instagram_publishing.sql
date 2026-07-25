-- Close the publishing loop: approved + scheduled creatives go out to Instagram
-- automatically instead of someone re-uploading them by hand.
--
-- The Graph API call already existed (publishInstagramPost) but nothing recorded
-- its outcome, so there was no way to know what had shipped, what failed, or to
-- stop the same post going out twice.

-- ── Per-post publishing state ───────────────────────────────────────────────
alter table public.creative_posts
  add column if not exists published_at timestamptz,
  add column if not exists ig_media_id text,
  add column if not exists publish_error text,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists publish_state text not null default 'idle';

alter table public.creative_posts
  drop constraint if exists creative_posts_publish_state_check;

alter table public.creative_posts
  add constraint creative_posts_publish_state_check
  check (publish_state in ('idle', 'queued', 'publishing', 'published', 'failed'));

comment on column public.creative_posts.publish_state is
  'idle = not queued; queued = due for publish; publishing = in flight (claim lock); published = live on Instagram; failed = last attempt errored.';
comment on column public.creative_posts.ig_media_id is
  'Instagram media id returned by media_publish. Also de-duplicates the post against the live feed in the simulator.';

-- The publisher claims work with this predicate; keep it index-backed.
create index if not exists idx_creative_posts_publish_queue
  on public.creative_posts (tenant_id, publish_state, scheduled_date)
  where publish_state in ('idle', 'queued', 'failed');

-- One Instagram media id can only ever map to one local post.
create unique index if not exists idx_creative_posts_ig_media_id
  on public.creative_posts (ig_media_id)
  where ig_media_id is not null;

-- ── Per-tenant opt-in ───────────────────────────────────────────────────────
-- Publishing is outward-facing and irreversible, so it stays off until the
-- agency explicitly turns it on for a brand.
alter table public.tenants
  add column if not exists auto_publish_instagram boolean not null default false;

comment on column public.tenants.auto_publish_instagram is
  'When true, the scheduled-publish cron may push approved Instagram posts live for this tenant.';
