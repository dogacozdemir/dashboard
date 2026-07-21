-- Google Analytics 4 — site-side truth to pair with ad-platform spend.
--
-- Ads tell us what we paid for; GA4 tells us what actually happened on the
-- client's site. Both are stored per tenant so every surface stays honest for
-- real accounts (demo tenants keep their showroom mocks).

-- Which GA4 property a tenant is bound to. One property per tenant.
create table if not exists public.ga4_properties (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  property_id   text not null,
  display_name  text,
  connected_at  timestamptz not null default now(),
  synced_at     timestamptz
);

alter table public.ga4_properties enable row level security;

create policy "ga4_properties_tenant_isolation" on public.ga4_properties
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

comment on table public.ga4_properties is
  'GA4 property bound to a tenant, discovered via the Analytics Admin API during Google OAuth sync.';

-- Daily site totals (one row per tenant per day).
create table if not exists public.ga4_daily_metrics (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  date              date not null,
  sessions          bigint  not null default 0,
  active_users      bigint  not null default 0,
  new_users         bigint  not null default 0,
  engaged_sessions  bigint  not null default 0,
  bounce_rate       numeric(12, 6) not null default 0,
  avg_session_secs  numeric(12, 4) not null default 0,
  conversions       numeric(16, 4) not null default 0,
  revenue           numeric(16, 4) not null default 0,
  synced_at         timestamptz not null default now(),
  unique (tenant_id, date)
);

alter table public.ga4_daily_metrics enable row level security;

create policy "ga4_daily_metrics_tenant_isolation" on public.ga4_daily_metrics
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_ga4_daily_tenant_date
  on public.ga4_daily_metrics (tenant_id, date desc);

-- Acquisition breakdown for the same window (default channel grouping).
create table if not exists public.ga4_channel_metrics (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  channel      text not null,
  sessions     bigint  not null default 0,
  active_users bigint  not null default 0,
  conversions  numeric(16, 4) not null default 0,
  revenue      numeric(16, 4) not null default 0,
  synced_at    timestamptz not null default now(),
  unique (tenant_id, channel)
);

alter table public.ga4_channel_metrics enable row level security;

create policy "ga4_channel_metrics_tenant_isolation" on public.ga4_channel_metrics
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_ga4_channels_tenant
  on public.ga4_channel_metrics (tenant_id, sessions desc);
