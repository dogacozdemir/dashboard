-- Lux Notification System: categories, actions, notifications.view permission + RLS

-- ─── Schema ─────────────────────────────────────────────────────
alter table public.notifications
  add column if not exists category text;

alter table public.notifications
  add column if not exists action_url text;

alter table public.notifications
  add column if not exists action_label text;

update public.notifications
set category = case
  when type = 'system' then 'system'
  when type = 'alert' then 'ai_strategic'
  else 'operational'
end
where category is null;

alter table public.notifications
  alter column category set default 'operational';

alter table public.notifications
  alter column category set not null;

alter table public.notifications
  drop constraint if exists notifications_category_check;

alter table public.notifications
  add constraint notifications_category_check
  check (category in ('ai_strategic', 'operational', 'system'));

comment on column public.notifications.category is
  'Lux tier: ai_strategic | operational | system';

comment on column public.notifications.action_url is
  'In-app path or URL for primary action (e.g. /strategy-technical).';

comment on column public.notifications.action_label is
  'CTA label shown in notification center.';

-- ─── Permission ─────────────────────────────────────────────────
insert into public.permissions (slug, description) values
  ('notifications.view', 'View Lux notification center and mark items read')
on conflict (slug) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.slug = 'notifications.view'
where r.slug in ('tenant_admin', 'tenant_user', 'super_admin')
on conflict (role_id, permission_id) do nothing;

-- ─── RLS: view + mark read with notifications.view ──────────────
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('notifications.view')
      or public.auth_has_permission('chat.send')
    )
  );

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update
  using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('notifications.view')
      or public.auth_has_permission('chat.send')
    )
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and (
      public.auth_has_permission('notifications.view')
      or public.auth_has_permission('chat.send')
    )
  );

-- INSERT unchanged: still requires chat.send (team chat) or service_role
