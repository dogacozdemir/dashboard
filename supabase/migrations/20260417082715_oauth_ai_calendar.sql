-- ============================================================
-- ad_accounts: OAuth tokens for connected ad platforms
-- ============================================================
create table if not exists public.ad_accounts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  platform        text not null check (platform in ('meta', 'google', 'tiktok')),
  account_id      text not null,
  account_name    text,
  access_token    text not null,
  refresh_token   text,
  token_expires_at timestamptz,
  iv              text not null,
  is_active       boolean not null default true,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (tenant_id, platform, account_id)
);

alter table public.ad_accounts enable row level security;

create policy "ad_accounts_tenant_isolation" on public.ad_accounts
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_ad_accounts_tenant
  on public.ad_accounts (tenant_id, platform);

-- ============================================================
-- ai_chat_history: AI Strategist conversation log
-- ============================================================
create table if not exists public.ai_chat_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  model       text not null default 'deepseek-chat',
  tokens_used int,
  created_at  timestamptz not null default now()
);

alter table public.ai_chat_history enable row level security;

create policy "ai_chat_history_tenant_isolation" on public.ai_chat_history
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_ai_chat_tenant
  on public.ai_chat_history (tenant_id, created_at desc);

-- Enable Realtime on ai_chat_history
alter publication supabase_realtime add table public.ai_chat_history;

-- ============================================================
-- calendar_events: Strategy calls + social media posts
-- ============================================================
create table if not exists public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  event_type      text not null check (event_type in ('strategy_call', 'social_post')),
  title           text not null,
  description     text,
  event_date      date not null,
  event_time      time,
  duration_min    int,
  meeting_url     text,
  platform        text check (platform in ('meta', 'google', 'tiktok', 'instagram', 'linkedin', 'x')),
  caption         text,
  creative_id     uuid references public.creative_assets(id) on delete set null,
  status          text not null default 'scheduled'
                  check (status in ('scheduled', 'done', 'cancelled')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

create policy "calendar_events_tenant_isolation" on public.calendar_events
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_calendar_events_tenant_date
  on public.calendar_events (tenant_id, event_date asc);
