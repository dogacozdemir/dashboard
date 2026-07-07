-- Carousel-first Creative Hub: parent creative_posts + slides in creative_assets
-- Backfills existing assets as one-post-per-asset; calendar links move to posts.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Parent table
-- ─────────────────────────────────────────────────────────────────────────────
create table public.creative_posts (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  title                 text not null,
  caption               text,
  platform              text
    check (platform in ('meta', 'google', 'tiktok', 'instagram', 'linkedin', 'x')),
  status                text not null default 'pending'
    check (status in ('pending', 'approved', 'revision')),
  scheduled_date        date,
  scheduled_time        time,
  social_post_event_id  uuid references public.calendar_events(id) on delete set null,
  thumbnail_url         text,
  uploaded_by           uuid not null references auth.users(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz default now()
);

create index idx_creative_posts_tenant_schedule
  on public.creative_posts (tenant_id, scheduled_date, status);
create index idx_creative_posts_tenant_created
  on public.creative_posts (tenant_id, created_at desc);

alter table public.creative_posts enable row level security;

create policy creative_posts_select_tenant on public.creative_posts
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );

create policy creative_posts_insert on public.creative_posts
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('creative.upload')
      or public.auth_has_permission('creative.approve')
    )
  );

create policy creative_posts_update on public.creative_posts
  for update
  using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('creative.approve')
      or public.auth_has_permission('creative.upload')
      or public.auth_has_permission('creative.comment')
    )
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('creative.approve')
      or public.auth_has_permission('creative.upload')
      or (
        public.auth_has_permission('creative.comment')
        and status is distinct from 'approved'
      )
    )
  );

create policy creative_posts_delete on public.creative_posts
  for delete using (public.auth_is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Link slides → posts (nullable during backfill)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.creative_assets
  add column if not exists post_id uuid references public.creative_posts(id) on delete cascade;

alter table public.creative_assets
  add column if not exists slide_index int not null default 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Backfill: one creative_post per existing asset
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
  nid uuid;
begin
  for r in
    select * from public.creative_assets where post_id is null
  loop
    insert into public.creative_posts (
      tenant_id,
      title,
      caption,
      platform,
      status,
      scheduled_date,
      scheduled_time,
      social_post_event_id,
      thumbnail_url,
      uploaded_by,
      created_at,
      updated_at
    )
    values (
      r.tenant_id,
      r.title,
      r.caption,
      r.platform,
      r.status,
      r.scheduled_date,
      r.scheduled_time,
      r.social_post_event_id,
      r.thumbnail_url,
      r.uploaded_by,
      r.created_at,
      now()
    )
    returning id into nid;

    update public.creative_assets
    set post_id = nid, slide_index = 0
    where id = r.id;
  end loop;
end $$;

alter table public.creative_assets alter column post_id set not null;

create unique index if not exists creative_assets_post_slide_unique
  on public.creative_assets (post_id, slide_index);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Calendar: link events to posts, drop legacy creative_id
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.calendar_events
  add column if not exists creative_post_id uuid references public.creative_posts(id) on delete set null;

update public.calendar_events ce
set creative_post_id = ca.post_id
from public.creative_assets ca
where ce.creative_id is not null
  and ce.creative_id = ca.id
  and ce.creative_post_id is null;

alter table public.calendar_events drop constraint if exists calendar_events_creative_id_fkey;
alter table public.calendar_events drop column if exists creative_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Drop denormalized columns from slides (canonical fields live on creative_posts)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists creative_assets_select_tenant on public.creative_assets;
drop policy if exists creative_assets_insert on public.creative_assets;
drop policy if exists creative_assets_update on public.creative_assets;
drop policy if exists creative_assets_delete on public.creative_assets;

alter table public.creative_assets drop column if exists caption;
alter table public.creative_assets drop column if exists platform;
alter table public.creative_assets drop column if exists status;
alter table public.creative_assets drop column if exists scheduled_date;
alter table public.creative_assets drop column if exists scheduled_time;
alter table public.creative_assets drop column if exists social_post_event_id;

create policy creative_assets_select_tenant on public.creative_assets
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );

create policy creative_assets_insert on public.creative_assets
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('creative.upload')
  );

create policy creative_assets_delete on public.creative_assets
  for delete using (public.auth_is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Revisions: optional slide index (null = whole post)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.revisions
  add column if not exists slide_index int;

comment on column public.revisions.slide_index is
  'Carousel slide ordinal (1-based UI); null = revision applies to the whole post';
