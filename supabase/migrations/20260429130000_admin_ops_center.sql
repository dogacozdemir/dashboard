-- Ops Center: admin_tasks + creative_assets.updated_at + super_admin notification read scope

-- ─── creative_assets: track updates (recent approvals) ───────────
alter table public.creative_assets
  add column if not exists updated_at timestamptz not null default now();

update public.creative_assets
set updated_at = created_at
where updated_at is null;

create or replace function public.set_creative_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_creative_assets_updated_at on public.creative_assets;
create trigger trg_creative_assets_updated_at
  before update on public.creative_assets
  for each row
  execute function public.set_creative_assets_updated_at();

-- ─── admin_tasks: extensible ops queue ───────────────────────────
create table if not exists public.admin_tasks (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  task_type           text not null,
  priority            text not null default 'medium'
                      check (priority in ('low', 'medium', 'high', 'critical')),
  status              text not null default 'open'
                      check (status in ('open', 'done', 'dismissed')),
  title               text not null,
  body                text,
  target_path         text not null default '/creative',
  related_entity_id   uuid,
  dedupe_key          text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  constraint admin_tasks_task_type_check check (task_type in (
    'MISSING_BRAND_VAULT',
    'CREATIVE_APPROVAL_PENDING',
    'CREATIVE_REVISION_REQUEST',
    'CREATIVE_APPROVED',
    'API_CONNECTION_LOST',
    'SPEND_LIMIT_EXCEEDED'
  ))
);

create index if not exists idx_admin_tasks_tenant_status
  on public.admin_tasks (tenant_id, status, created_at desc);

create index if not exists idx_admin_tasks_status_priority
  on public.admin_tasks (status, priority, created_at desc);

create unique index if not exists idx_admin_tasks_dedupe_open
  on public.admin_tasks (dedupe_key)
  where (status = 'open');

comment on table public.admin_tasks is
  'Madmonos Super Admin ops queue; populated by app bridge + fetch merges computed rows.';

alter table public.admin_tasks enable row level security;

create policy "admin_tasks_super_admin_select" on public.admin_tasks
  for select to authenticated
  using (public.auth_is_super_admin());

create policy "admin_tasks_super_admin_insert" on public.admin_tasks
  for insert to authenticated
  with check (public.auth_is_super_admin());

create policy "admin_tasks_super_admin_update" on public.admin_tasks
  for update to authenticated
  using (public.auth_is_super_admin())
  with check (public.auth_is_super_admin());

create policy "admin_tasks_super_admin_delete" on public.admin_tasks
  for delete to authenticated
  using (public.auth_is_super_admin());

-- ─── Super Admin: read tenant notifications while impersonating ──
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (
    public.auth_is_super_admin()
    or (
      tenant_id in (select tenant_id from public.users where id = auth.uid())
      and (
        public.auth_has_permission('notifications.view')
        or public.auth_has_permission('chat.send')
      )
    )
  );

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update
  using (
    public.auth_is_super_admin()
    or (
      tenant_id in (select tenant_id from public.users where id = auth.uid())
      and (
        public.auth_has_permission('notifications.view')
        or public.auth_has_permission('chat.send')
      )
    )
  )
  with check (
    public.auth_is_super_admin()
    or (
      tenant_id in (select tenant_id from public.users where id = auth.uid())
      and (
        public.auth_has_permission('notifications.view')
        or public.auth_has_permission('chat.send')
      )
    )
  );

-- ─── Optional analytics view (table-only; computed rows live in app) ─
create or replace view public.admin_ops_view as
select
  t.id,
  t.tenant_id,
  tn.slug   as tenant_slug,
  tn.name   as tenant_name,
  t.task_type,
  t.priority,
  t.status,
  t.title,
  t.body,
  t.target_path,
  t.related_entity_id,
  t.dedupe_key,
  t.created_at,
  t.updated_at,
  t.resolved_at
from public.admin_tasks t
join public.tenants tn on tn.id = t.tenant_id;

comment on view public.admin_ops_view is
  'Open/done admin tasks joined with tenant slug for reporting.';
