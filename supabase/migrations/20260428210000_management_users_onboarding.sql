-- management.users permission + optional industry for onboarding + auth → public.users for invites

insert into public.permissions (slug, description) values
  ('management.users', 'Invite and manage users in own tenant')
on conflict (slug) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.slug = 'management.users'
where r.slug in ('super_admin', 'tenant_admin')
on conflict do nothing;

alter table public.tenants
  add column if not exists industry text;

comment on column public.tenants.industry is 'Optional vertical for MonoAI onboarding copy (e.g. E-commerce, SaaS).';

-- When Supabase Auth creates a user with tenant_id in raw_user_meta_data (invite), mirror to public.users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  r   text;
begin
  tid := nullif(new.raw_user_meta_data->>'tenant_id', '')::uuid;
  if tid is null then
    return new;
  end if;

  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'tenant_user');
  if r not in ('tenant_admin', 'tenant_user') then
    r := 'tenant_user';
  end if;

  insert into public.users (id, email, full_name, avatar_url, role, tenant_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    null,
    r::text,
    tid
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name),
        role      = excluded.role,
        tenant_id = excluded.tenant_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
