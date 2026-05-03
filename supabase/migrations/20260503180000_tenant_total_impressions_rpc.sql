-- Lifetime impressions sum for gamification milestones (reach_100k).
create or replace function public.tenant_total_impressions(p_tenant_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(impressions), 0)::bigint
  from public.daily_metrics
  where tenant_id = p_tenant_id;
$$;

grant execute on function public.tenant_total_impressions(uuid) to authenticated;
grant execute on function public.tenant_total_impressions(uuid) to service_role;
