-- GSC-backed rows in geo_reports + landing page analytics

alter table public.geo_reports
  add column if not exists metric_source text not null default 'geo_rank';

alter table public.geo_reports
  drop constraint if exists geo_reports_metric_source_check;

alter table public.geo_reports
  add constraint geo_reports_metric_source_check
  check (metric_source in ('geo_rank', 'gsc_query'));

comment on column public.geo_reports.metric_source is 'geo_rank = AI/GEO tracking; gsc_query = Google Search Console query aggregate';

create unique index if not exists idx_geo_reports_gsc_query_unique
  on public.geo_reports (tenant_id, keyword, engine)
  where metric_source = 'gsc_query';

-- Landing-page level GSC metrics (dimension: page)
create table if not exists public.gsc_page_analytics (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  page_url      text not null,
  clicks        integer not null default 0,
  impressions   bigint not null default 0,
  ctr           numeric(12, 6) not null default 0,
  position      numeric(12, 4) not null default 0,
  synced_at     timestamptz not null default now(),
  unique (tenant_id, page_url)
);

alter table public.gsc_page_analytics enable row level security;

create policy "gsc_page_analytics_tenant_isolation" on public.gsc_page_analytics
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_gsc_pages_tenant
  on public.gsc_page_analytics (tenant_id, synced_at desc);
