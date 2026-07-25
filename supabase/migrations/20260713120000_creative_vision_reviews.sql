-- Vision-based creative review.
--
-- MonoAI's chat layer is text-only, so until now it could read a creative's
-- title and comments but never see the artwork. Reviews run on a vision model
-- and are cached here: they cost real tokens, so re-opening a post must not
-- re-run the critique.

create table if not exists public.creative_vision_reviews (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  post_id       uuid not null references public.creative_posts(id) on delete cascade,
  /** Slide set the review covers — a new upload invalidates the cached review. */
  slide_fingerprint text not null,
  verdict       text not null,
  summary       text not null,
  /** [{ area, severity, note, suggestion }] — rendered as the findings list. */
  findings      jsonb not null default '[]'::jsonb,
  strengths     jsonb not null default '[]'::jsonb,
  model         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (post_id, slide_fingerprint)
);

alter table public.creative_vision_reviews
  drop constraint if exists creative_vision_reviews_verdict_check;

alter table public.creative_vision_reviews
  add constraint creative_vision_reviews_verdict_check
  check (verdict in ('ready', 'minor_issues', 'needs_work'));

alter table public.creative_vision_reviews enable row level security;

create policy "creative_vision_reviews_tenant_isolation" on public.creative_vision_reviews
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_creative_vision_reviews_post
  on public.creative_vision_reviews (tenant_id, post_id, created_at desc);

comment on column public.creative_vision_reviews.slide_fingerprint is
  'Hash of the reviewed slide URLs — re-uploading media produces a new fingerprint so a stale review is never shown against new artwork.';
