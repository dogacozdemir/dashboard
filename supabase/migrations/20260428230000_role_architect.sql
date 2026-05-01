-- Role Architect: role_id on users, sort_order + tenant_id on roles, tenant denials, auth + RLS

-- ─── roles: ordering & tenant-scoped custom roles ─────────────────
alter table public.roles add column if not exists sort_order int not null default 0;
alter table public.roles add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.roles drop constraint if exists roles_slug_key;

create unique index if not exists roles_slug_lower_unique
  on public.roles (lower(trim(slug)));

create index if not exists roles_tenant_sort_idx
  on public.roles (tenant_id, sort_order);

update public.roles set tenant_id = null, sort_order = 0 where slug = 'super_admin';
update public.roles set tenant_id = null, sort_order = 1 where slug = 'tenant_admin';
update public.roles set tenant_id = null, sort_order = 2 where slug = 'tenant_user';

-- ─── users.role_id (canonical) ───────────────────────────────────
alter table public.users add column if not exists role_id uuid references public.roles(id);

update public.users u
set role_id = r.id
from public.roles r
where r.slug = u.role and r.tenant_id is null;

update public.users
set role_id = (select id from public.roles where slug = 'tenant_user' and tenant_id is null limit 1)
where role_id is null;

alter table public.users alter column role_id set not null;

alter table public.users drop constraint if exists users_role_check;

create or replace function public.sync_user_role_slug()
returns trigger
language plpgsql
as $$
begin
  select r.slug into strict new.role
  from public.roles r
  where r.id = new.role_id;
  return new;
exception
  when no_data_found then
    raise exception 'Invalid role_id';
end;
$$;

drop trigger if exists trg_users_sync_role on public.users;
create trigger trg_users_sync_role
  before insert or update of role_id on public.users
  for each row
  execute function public.sync_user_role_slug();

update public.users u
set role = r.slug
from public.roles r
where u.role_id = r.id
  and (u.role is distinct from r.slug);

-- ─── Tenant permission denials (subtract from global role_permissions) ───
create table if not exists public.tenant_role_permission_denials (
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (tenant_id, role_id, permission_id)
);

create index if not exists idx_denials_tenant on public.tenant_role_permission_denials(tenant_id);

alter table public.tenant_role_permission_denials enable row level security;

create policy "denials_super_admin_all" on public.tenant_role_permission_denials
  for all to authenticated
  using (public.auth_is_super_admin())
  with check (public.auth_is_super_admin());

-- ─── auth_has_permission: role_id + denials ──────────────────────
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
      join public.roles r on r.id = u.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id and p.slug = p_slug
      where u.id = auth.uid()
        and not exists (
          select 1
          from public.tenant_role_permission_denials d
          where d.tenant_id = u.tenant_id
            and d.role_id = r.id
            and d.permission_id = p.id
        )
    ),
    false
  );
$$;

-- ─── Super Admin cannot delete core role ─────────────────────────
create or replace function public.protect_super_admin_role()
returns trigger
language plpgsql
as $$
begin
  if old.slug = 'super_admin' then
    raise exception 'super_admin role cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_roles_protect_super on public.roles;
create trigger trg_roles_protect_super
  before delete on public.roles
  for each row
  execute function public.protect_super_admin_role();

-- ─── RLS: super_admin can mutate roles / role_permissions ────────
create policy "roles_super_admin_insert" on public.roles
  for insert to authenticated
  with check (public.auth_is_super_admin());

create policy "roles_super_admin_update" on public.roles
  for update to authenticated
  using (public.auth_is_super_admin())
  with check (public.auth_is_super_admin());

create policy "roles_super_admin_delete" on public.roles
  for delete to authenticated
  using (public.auth_is_super_admin());

create policy "role_permissions_super_insert" on public.role_permissions
  for insert to authenticated
  with check (public.auth_is_super_admin());

create policy "role_permissions_super_update" on public.role_permissions
  for update to authenticated
  using (public.auth_is_super_admin())
  with check (public.auth_is_super_admin());

create policy "role_permissions_super_delete" on public.role_permissions
  for delete to authenticated
  using (public.auth_is_super_admin());

-- ─── Invite handler: role_id preferred ─────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  rid uuid;
  rslug text;
begin
  tid := nullif(new.raw_user_meta_data->>'tenant_id', '')::uuid;
  if tid is null then
    return new;
  end if;

  rid := nullif(new.raw_user_meta_data->>'role_id', '')::uuid;
  if rid is not null then
    if not exists (select 1 from public.roles where id = rid and (tenant_id is null or tenant_id = tid)) then
      rid := null;
    end if;
  end if;

  if rid is null then
    rslug := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'tenant_user');
    select id into rid from public.roles
    where slug = rslug and tenant_id is null
    limit 1;
  end if;

  if rid is null then
    select id into rid from public.roles where slug = 'tenant_user' and tenant_id is null limit 1;
  end if;

  insert into public.users (id, email, full_name, avatar_url, role_id, tenant_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    null,
    rid,
    tid
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name),
        role_id   = excluded.role_id,
        tenant_id = excluded.tenant_id;

  return new;
end;
$$;
