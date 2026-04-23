-- ============================================================
-- daily_metrics: per-day platform spend aggregates
-- ============================================================
create table if not exists public.daily_metrics (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  date          date not null,
  platform      text not null check (platform in ('meta', 'google', 'tiktok')),
  spend         numeric(12, 2) not null default 0,
  impressions   bigint not null default 0,
  clicks        bigint not null default 0,
  conversions   int not null default 0,
  roas          numeric(6, 2) not null default 0,
  ctr           numeric(8, 4) not null default 0,
  created_at    timestamptz not null default now(),
  unique (tenant_id, date, platform)
);

alter table public.daily_metrics enable row level security;

create policy "daily_metrics_tenant_isolation" on public.daily_metrics
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_daily_metrics_tenant_date
  on public.daily_metrics (tenant_id, date desc);

-- ============================================================
-- technical_logs: activity feed entries
-- ============================================================
create table if not exists public.technical_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  type        text not null check (type in ('campaign', 'creative', 'report', 'brand', 'system')),
  description text not null,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.technical_logs enable row level security;

create policy "technical_logs_tenant_isolation" on public.technical_logs
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_technical_logs_tenant
  on public.technical_logs (tenant_id, created_at desc);

-- ============================================================
-- roadmap_milestones: strategy + calendar milestones
-- ============================================================
create table if not exists public.roadmap_milestones (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'upcoming'
              check (status in ('completed', 'in-progress', 'upcoming')),
  category    text not null default 'technical'
              check (category in ('technical', 'content', 'geo', 'performance')),
  eta         text,
  eta_date    date,
  created_at  timestamptz not null default now()
);

alter table public.roadmap_milestones enable row level security;

create policy "roadmap_milestones_tenant_isolation" on public.roadmap_milestones
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_roadmap_tenant
  on public.roadmap_milestones (tenant_id, eta_date asc);

-- ============================================================
-- notifications: chat messages + system alerts
-- ============================================================
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  sender_name  text not null default 'System',
  message      text not null,
  type         text not null default 'message'
               check (type in ('message', 'alert', 'approval', 'system')),
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_tenant_isolation" on public.notifications
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_notifications_tenant
  on public.notifications (tenant_id, created_at desc);

-- Enable Realtime on notifications
alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- strategy_logs: AI-generated insights cache
-- ============================================================
create table if not exists public.strategy_logs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  report_type   text not null check (report_type in ('geo', 'seo', 'market_insight')),
  content       jsonb not null default '{}',
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table public.strategy_logs enable row level security;

create policy "strategy_logs_tenant_isolation" on public.strategy_logs
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_strategy_logs_tenant
  on public.strategy_logs (tenant_id, report_type, generated_at desc);
