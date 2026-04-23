-- ============================================================
-- Madmonos Dashboard — Supabase Schema + RLS Policies
-- ============================================================

-- ============================================================
-- STEP 1: CREATE ALL TABLES (no policies yet)
-- ============================================================

create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  logo_url      text,
  custom_domain text unique,
  plan          text not null default 'starter' check (plan in ('starter', 'growth', 'enterprise')),
  primary_color text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'client' check (role in ('admin', 'client', 'viewer')),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.ad_campaigns (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  platform      text not null check (platform in ('meta', 'google', 'tiktok')),
  campaign_name text not null,
  data          jsonb not null default '{}',
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table if not exists public.creative_assets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  title         text not null,
  url           text not null,
  thumbnail_url text,
  type          text not null check (type in ('image', 'video')),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'revision')),
  uploaded_by   uuid not null references auth.users(id),
  created_at    timestamptz not null default now()
);

create table if not exists public.revisions (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.creative_assets(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  comment     text not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.brand_assets (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('logo', 'brand-book', 'font', 'color-palette', 'other')),
  url         text not null,
  file_size   bigint,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.geo_reports (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  keyword     text not null,
  rank_data   jsonb not null default '{}',
  engine      text not null check (engine in ('google', 'bing', 'perplexity', 'chatgpt')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ============================================================

alter table public.tenants         enable row level security;
alter table public.users           enable row level security;
alter table public.ad_campaigns    enable row level security;
alter table public.creative_assets enable row level security;
alter table public.revisions       enable row level security;
alter table public.brand_assets    enable row level security;
alter table public.geo_reports     enable row level security;

-- ============================================================
-- STEP 3: RLS POLICIES (all tables exist now)
-- ============================================================

-- tenants
create policy "tenant_select_own" on public.tenants
  for select using (
    auth.uid() in (
      select id from public.users where tenant_id = tenants.id
    )
  );

create policy "tenant_admin_all" on public.tenants
  for all using (
    auth.uid() in (
      select id from public.users where role = 'admin'
    )
  );

-- users
-- IMPORTANT:
-- Never reference public.users from its own policy conditions directly:
-- that causes infinite recursion in RLS.
create policy "users_select_own" on public.users
  for select using (id = auth.uid());

create policy "users_update_own" on public.users
  for update using (id = auth.uid());

-- ad_campaigns
create policy "campaigns_tenant_isolation" on public.ad_campaigns
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

-- creative_assets
create policy "creative_assets_tenant_isolation" on public.creative_assets
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

-- revisions
create policy "revisions_tenant_isolation" on public.revisions
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

-- brand_assets
create policy "brand_assets_tenant_isolation" on public.brand_assets
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

-- geo_reports
create policy "geo_reports_tenant_isolation" on public.geo_reports
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

-- ============================================================
-- STEP 4: INDEXES
-- ============================================================

create index if not exists idx_users_tenant       on public.users(tenant_id);
create index if not exists idx_users_uid          on public.users(id);

create index if not exists idx_campaigns_tenant   on public.ad_campaigns(tenant_id);
create index if not exists idx_campaigns_platform on public.ad_campaigns(tenant_id, platform);

create index if not exists idx_creative_tenant    on public.creative_assets(tenant_id);
create index if not exists idx_creative_status    on public.creative_assets(tenant_id, status);

create index if not exists idx_revisions_asset    on public.revisions(asset_id);
create index if not exists idx_revisions_tenant   on public.revisions(tenant_id);

create index if not exists idx_brand_tenant       on public.brand_assets(tenant_id);
create index if not exists idx_brand_type         on public.brand_assets(tenant_id, type);

create index if not exists idx_geo_tenant         on public.geo_reports(tenant_id);
create index if not exists idx_geo_engine         on public.geo_reports(tenant_id, engine);

create index if not exists idx_tenants_slug       on public.tenants(slug);
create index if not exists idx_tenants_active     on public.tenants(is_active) where is_active = true;
