-- Competitor tracking — a persistent watch list plus change detection.
--
-- MonoAI already has ad-hoc crawl/search tools, but nothing remembered which
-- competitors a client cares about or noticed when their pages changed. This
-- turns that into a standing capability: the agency lists competitors once, and
-- the sync cron re-checks each page and summarises what moved.

create table if not exists public.competitors (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  url         text not null,
  is_active   boolean not null default true,
  -- Throttle marker: the cron skips a competitor checked within the window.
  last_checked_at timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (tenant_id, url)
);

alter table public.competitors enable row level security;

create policy "competitors_tenant_isolation" on public.competitors
  for all using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );

create index if not exists idx_competitors_tenant
  on public.competitors (tenant_id, is_active);

-- The cron claims work with this predicate; keep it index-backed.
create index if not exists idx_competitors_due
  on public.competitors (tenant_id, last_checked_at)
  where is_active = true;

-- One row per observed version of a competitor page. A new row is written only
-- when the page's content hash changes, so the history is a change log, not a
-- crawl log.
create table if not exists public.competitor_snapshots (
  id             uuid primary key default gen_random_uuid(),
  competitor_id  uuid not null references public.competitors(id) on delete cascade,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  content_hash   text not null,
  text_excerpt   text,
  -- AI summary of what changed vs the previous snapshot; null on the first one.
  change_summary text,
  -- false for the initial baseline capture, true for every subsequent change.
  changed        boolean not null default false,
  fetched_at     timestamptz not null default now()
);

alter table public.competitor_snapshots enable row level security;

create policy "competitor_snapshots_tenant_isolation" on public.competitor_snapshots
  for all using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );

create index if not exists idx_competitor_snapshots_latest
  on public.competitor_snapshots (competitor_id, fetched_at desc);

comment on table public.competitors is
  'Per-tenant competitor watch list. The sync cron re-checks each active URL and records changes as snapshots.';
comment on column public.competitor_snapshots.changed is
  'false = baseline capture (first ever), true = the page changed since the previous snapshot.';
