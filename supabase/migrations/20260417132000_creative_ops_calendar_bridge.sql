-- Bridge Creative Studio approvals to Ops Calendar social posts

alter table public.creative_assets
  add column if not exists platform text
    check (platform in ('meta', 'google', 'tiktok', 'instagram', 'linkedin', 'x'));

alter table public.creative_assets
  add column if not exists caption text;

alter table public.creative_assets
  add column if not exists scheduled_date date;

alter table public.creative_assets
  add column if not exists scheduled_time time;

alter table public.creative_assets
  add column if not exists social_post_event_id uuid
    references public.calendar_events(id) on delete set null;

create index if not exists idx_creative_schedule
  on public.creative_assets (tenant_id, scheduled_date, status);

