-- Platform-wide settings singleton (God Mode /settings page).

create table if not exists public.system_settings (
  id                     integer primary key default 1 check (id = 1),
  maintenance_mode       boolean not null default false,
  global_signups_allowed boolean not null default true,
  system_log_level       text not null default 'info'
    check (system_log_level in ('error', 'warn', 'info', 'debug')),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.users(id) on delete set null
);

comment on table public.system_settings is
  'Singleton platform configuration row (id = 1). Super Admin only.';

insert into public.system_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.system_settings enable row level security;

create policy "system_settings_super_admin_select" on public.system_settings
  for select to authenticated
  using (public.auth_is_super_admin());

create policy "system_settings_super_admin_update" on public.system_settings
  for update to authenticated
  using (public.auth_is_super_admin())
  with check (public.auth_is_super_admin());
