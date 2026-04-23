-- ============================================================
-- Realtime hardening:
-- 1) ensure publication contains required tables
-- 2) allow tenant-claim based read for websocket JWT
-- 3) provide a DB healthcheck function
-- ============================================================

-- Ensure publication membership (safe to run multiple times)
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.ai_chat_history;
  exception when duplicate_object then
    null;
  end;
end $$;

-- RLS helper: tenant can be validated either by auth.uid() mapped user row
-- OR by a short-lived JWT containing tenant_id claim for realtime channels.
create or replace function public.has_tenant_access(target_tenant uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.tenant_id = target_tenant
    )
    or (
      auth.jwt() ? 'tenant_id'
      and nullif(auth.jwt() ->> 'tenant_id', '')::uuid = target_tenant
    );
$$;

-- Update realtime tables to use helper function
drop policy if exists "notifications_tenant_isolation" on public.notifications;
create policy "notifications_tenant_isolation" on public.notifications
  for all using (public.has_tenant_access(tenant_id));

drop policy if exists "ai_chat_history_tenant_isolation" on public.ai_chat_history;
create policy "ai_chat_history_tenant_isolation" on public.ai_chat_history
  for all using (public.has_tenant_access(tenant_id));

-- Optional troubleshooting helper for DB engineer runbooks
create or replace function public.realtime_healthcheck()
returns table (
  notifications_in_publication boolean,
  ai_chat_history_in_publication boolean,
  notifications_rls_enabled boolean,
  ai_chat_history_rls_enabled boolean
)
language sql
stable
as $$
  select
    exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) as notifications_in_publication,
    exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ai_chat_history'
    ) as ai_chat_history_in_publication,
    exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'notifications'
        and c.relrowsecurity = true
    ) as notifications_rls_enabled,
    exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'ai_chat_history'
        and c.relrowsecurity = true
    ) as ai_chat_history_rls_enabled;
$$;
