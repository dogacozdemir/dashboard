-- ============================================================
-- RBAC: roles, permissions, role_permissions + users.role migration
-- RLS helpers: auth_is_super_admin(), auth_has_permission(slug)
-- ============================================================

-- ─── Roles ─────────────────────────────────────────────────
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- ─── Permissions ───────────────────────────────────────────
create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create index if not exists idx_role_permissions_role on public.role_permissions(role_id);

-- Seed roles
insert into public.roles (slug, description) values
  ('super_admin', 'Madmonos platform — full access'),
  ('tenant_admin', 'Client lead — manage tenant, integrations, approvals'),
  ('tenant_user', 'Client staff — view, comment, MonoAI')
on conflict (slug) do nothing;

-- Seed permissions
insert into public.permissions (slug, description) values
  ('creative.upload', 'Upload creative assets'),
  ('creative.approve', 'Approve creative assets / change status'),
  ('creative.comment', 'Add revision comments'),
  ('brand.upload', 'Upload Brand Vault assets'),
  ('integrations.manage', 'OAuth, ad sync, GSC sync, ad_accounts tokens'),
  ('strategy.geo_run', 'Run GEO AI report (writes geo_reports, strategy_logs)'),
  ('strategy.insight_write', 'Write market insight / strategy_logs (AI cache)'),
  ('calendar.create', 'Create calendar events'),
  ('chat.send', 'Send chat / notifications'),
  ('ai.mono_chat', 'Use MonoAI — ai_chat_history, summaries')
on conflict (slug) do nothing;

-- Map role → permissions (super_admin: all)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.slug = 'super_admin'
on conflict do nothing;

-- tenant_admin
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.slug in (
  'creative.upload', 'creative.approve', 'creative.comment', 'brand.upload',
  'integrations.manage', 'strategy.geo_run', 'strategy.insight_write',
  'calendar.create', 'chat.send', 'ai.mono_chat'
)
where r.slug = 'tenant_admin'
on conflict do nothing;

-- tenant_user
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.slug in (
  'creative.comment', 'chat.send', 'ai.mono_chat'
)
where r.slug = 'tenant_user'
on conflict do nothing;

-- ─── Migrate users.role values ───────────────────────────────
alter table public.users drop constraint if exists users_role_check;

update public.users set role = 'super_admin' where role = 'admin';
update public.users set role = 'tenant_admin' where role = 'client';
update public.users set role = 'tenant_user' where role = 'viewer';

alter table public.users
  add constraint users_role_check
  check (role in ('super_admin', 'tenant_admin', 'tenant_user'));

alter table public.users alter column role set default 'tenant_user';

-- FK optional: enforce role exists (soft — roles seeded)
-- alter table public.users add constraint users_role_fk foreign key (role) references public.roles(slug);

-- ─── RLS on RBAC meta-tables (read for authenticated) ────────
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

create policy "roles_read_authenticated" on public.roles for select to authenticated using (true);
create policy "permissions_read_authenticated" on public.permissions for select to authenticated using (true);
create policy "role_permissions_read_authenticated" on public.role_permissions for select to authenticated using (true);

-- ─── Helper functions (SECURITY DEFINER) ─────────────────────
create or replace function public.auth_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'super_admin'
  );
$$;

create or replace function public.auth_has_permission(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.auth_is_super_admin()
    or exists (
      select 1
      from public.users u
      join public.roles r on r.slug = u.role
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id and p.slug = p_slug
      where u.id = auth.uid()
    ),
    false
  );
$$;

grant execute on function public.auth_is_super_admin() to authenticated;
grant execute on function public.auth_has_permission(text) to authenticated;
grant execute on function public.auth_is_super_admin() to service_role;
grant execute on function public.auth_has_permission(text) to service_role;

comment on function public.auth_has_permission(text) is
  'True if current user has permission slug or is super_admin.';

-- ─── tenants policies ────────────────────────────────────────
drop policy if exists "tenant_admin_all" on public.tenants;
create policy "tenant_super_admin_all" on public.tenants
  for all
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'super_admin')
  )
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'super_admin')
  );

-- ─── creative_assets ─────────────────────────────────────────
drop policy if exists "creative_assets_tenant_isolation" on public.creative_assets;
create policy "creative_assets_select_tenant" on public.creative_assets
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "creative_assets_insert" on public.creative_assets
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('creative.upload')
  );
create policy "creative_assets_update" on public.creative_assets
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
create policy "creative_assets_delete" on public.creative_assets
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('creative.approve')
  );

-- ─── revisions ───────────────────────────────────────────────
drop policy if exists "revisions_tenant_isolation" on public.revisions;
create policy "revisions_select_tenant" on public.revisions
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "revisions_insert" on public.revisions
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('creative.comment')
  );
create policy "revisions_update" on public.revisions
  for update using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('creative.comment')
  );
create policy "revisions_delete" on public.revisions
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('creative.approve')
  );

-- ─── brand_assets ────────────────────────────────────────────
drop policy if exists "brand_assets_tenant_isolation" on public.brand_assets;
create policy "brand_assets_select_tenant" on public.brand_assets
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "brand_assets_insert" on public.brand_assets
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('brand.upload')
  );
create policy "brand_assets_update" on public.brand_assets
  for update using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('brand.upload')
  );
create policy "brand_assets_delete" on public.brand_assets
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('brand.upload')
  );

-- ─── ad_accounts ─────────────────────────────────────────────
drop policy if exists "ad_accounts_tenant_isolation" on public.ad_accounts;
create policy "ad_accounts_select_tenant" on public.ad_accounts
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "ad_accounts_insert" on public.ad_accounts
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "ad_accounts_update" on public.ad_accounts
  for update using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "ad_accounts_delete" on public.ad_accounts
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );

-- ─── calendar_events ─────────────────────────────────────────
drop policy if exists "calendar_events_tenant_isolation" on public.calendar_events;
create policy "calendar_events_select" on public.calendar_events
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "calendar_events_insert" on public.calendar_events
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('calendar.create')
  );
create policy "calendar_events_update" on public.calendar_events
  for update using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('calendar.create')
  );
create policy "calendar_events_delete" on public.calendar_events
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('calendar.create')
  );

-- ─── strategy_logs ───────────────────────────────────────────
drop policy if exists "strategy_logs_tenant_isolation" on public.strategy_logs;
create policy "strategy_logs_select" on public.strategy_logs
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "strategy_logs_insert" on public.strategy_logs
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('strategy.geo_run')
      or public.auth_has_permission('strategy.insight_write')
    )
  );
create policy "strategy_logs_update" on public.strategy_logs
  for update using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('strategy.geo_run')
      or public.auth_has_permission('strategy.insight_write')
    )
  );
create policy "strategy_logs_delete" on public.strategy_logs
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('strategy.geo_run')
      or public.auth_has_permission('strategy.insight_write')
    )
  );

-- ─── geo_reports ─────────────────────────────────────────────
drop policy if exists "geo_reports_tenant_isolation" on public.geo_reports;
create policy "geo_reports_select" on public.geo_reports
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "geo_reports_insert" on public.geo_reports
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('integrations.manage')
      or public.auth_has_permission('strategy.geo_run')
    )
  );
create policy "geo_reports_update" on public.geo_reports
  for update using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('integrations.manage')
      or public.auth_has_permission('strategy.geo_run')
    )
  );
create policy "geo_reports_delete" on public.geo_reports
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('integrations.manage')
      or public.auth_has_permission('strategy.geo_run')
    )
  );

-- ─── gsc_page_analytics ──────────────────────────────────────
drop policy if exists "gsc_page_analytics_tenant_isolation" on public.gsc_page_analytics;
create policy "gsc_page_analytics_select" on public.gsc_page_analytics
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "gsc_page_analytics_insert" on public.gsc_page_analytics
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "gsc_page_analytics_update" on public.gsc_page_analytics
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "gsc_page_analytics_delete" on public.gsc_page_analytics
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );

-- ─── technical_logs (sync inserts) ───────────────────────────
drop policy if exists "technical_logs_tenant_isolation" on public.technical_logs;
create policy "technical_logs_select" on public.technical_logs
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "technical_logs_insert" on public.technical_logs
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "technical_logs_update" on public.technical_logs
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "technical_logs_delete" on public.technical_logs
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );

-- ─── notifications (chat) ────────────────────────────────────
drop policy if exists "notifications_tenant_isolation" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "notifications_insert" on public.notifications
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('chat.send')
  );
create policy "notifications_update" on public.notifications
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('chat.send')
  );
create policy "notifications_delete" on public.notifications
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('chat.send')
  );

-- ─── ai_chat_history ─────────────────────────────────────────
drop policy if exists "ai_chat_history_tenant_isolation" on public.ai_chat_history;
create policy "ai_chat_history_select" on public.ai_chat_history
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "ai_chat_history_insert" on public.ai_chat_history
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('ai.mono_chat')
  );
create policy "ai_chat_history_update" on public.ai_chat_history
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('ai.mono_chat')
  );
create policy "ai_chat_history_delete" on public.ai_chat_history
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('ai.mono_chat')
  );

-- ─── ai_chat_summaries ───────────────────────────────────────
drop policy if exists "ai_chat_summaries_tenant_isolation" on public.ai_chat_summaries;
create policy "ai_chat_summaries_select" on public.ai_chat_summaries
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "ai_chat_summaries_insert" on public.ai_chat_summaries
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('ai.mono_chat')
  );
create policy "ai_chat_summaries_update" on public.ai_chat_summaries
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('ai.mono_chat')
  );
create policy "ai_chat_summaries_delete" on public.ai_chat_summaries
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('ai.mono_chat')
  );

-- ─── brand_knowledge_chunks ──────────────────────────────────
drop policy if exists "brand_knowledge_chunks_tenant_isolation" on public.brand_knowledge_chunks;
create policy "brand_knowledge_chunks_select" on public.brand_knowledge_chunks
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "brand_knowledge_chunks_insert" on public.brand_knowledge_chunks
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('brand.upload')
  );
create policy "brand_knowledge_chunks_update" on public.brand_knowledge_chunks
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('brand.upload')
  );
create policy "brand_knowledge_chunks_delete" on public.brand_knowledge_chunks
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('brand.upload')
  );

-- ─── ad_campaigns, daily_metrics: tenant read; write via integration ──
drop policy if exists "campaigns_tenant_isolation" on public.ad_campaigns;
create policy "ad_campaigns_select" on public.ad_campaigns
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "ad_campaigns_insert" on public.ad_campaigns
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "ad_campaigns_update" on public.ad_campaigns
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "ad_campaigns_delete" on public.ad_campaigns
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );

drop policy if exists "daily_metrics_tenant_isolation" on public.daily_metrics;
create policy "daily_metrics_select" on public.daily_metrics
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "daily_metrics_insert" on public.daily_metrics
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "daily_metrics_update" on public.daily_metrics
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
create policy "daily_metrics_delete" on public.daily_metrics
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );

-- ─── roadmap_milestones (read all tenant; write admin-only product decision) ──
-- Keep tenant read; writes rare from app — restrict to tenant_admin capabilities via calendar/strategy
-- For simplicity: only integrations.manage could write roadmap if ever — use strategy.insight_write OR tenant_admin
drop policy if exists "roadmap_milestones_tenant_isolation" on public.roadmap_milestones;
create policy "roadmap_milestones_select" on public.roadmap_milestones
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );
create policy "roadmap_milestones_insert" on public.roadmap_milestones
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('calendar.create')
  );
create policy "roadmap_milestones_update" on public.roadmap_milestones
  for update using (tenant_id in (select tenant_id from public.users where id = auth.uid()))
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('calendar.create')
  );
create policy "roadmap_milestones_delete" on public.roadmap_milestones
  for delete using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('calendar.create')
  );
