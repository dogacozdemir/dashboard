-- Server-side aggregation for daily_metrics (avoids loading every row into Node for KPI math).
-- SECURITY INVOKER: RLS on daily_metrics applies when called with a user JWT.

create or replace function public.aggregate_daily_metrics_range(
  p_tenant_id uuid,
  p_from date,
  p_to date
)
returns table (
  platform text,
  spend numeric,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  roas_sum numeric,
  ctr_sum numeric,
  row_count bigint,
  revenue numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    dm.platform::text,
    coalesce(sum(dm.spend), 0)::numeric,
    coalesce(sum(dm.impressions), 0)::bigint,
    coalesce(sum(dm.clicks), 0)::bigint,
    coalesce(sum(dm.conversions), 0)::bigint,
    coalesce(sum(dm.roas), 0)::numeric,
    coalesce(sum(dm.ctr), 0)::numeric,
    count(*)::bigint,
    coalesce(sum(dm.spend * dm.roas), 0)::numeric
  from public.daily_metrics dm
  where dm.tenant_id = p_tenant_id
    and dm.date >= p_from
    and dm.date <= p_to
  group by dm.platform;
$$;

comment on function public.aggregate_daily_metrics_range(uuid, date, date) is
  'Per-platform sums for daily_metrics; revenue = sum(spend * roas) per row.';

grant execute on function public.aggregate_daily_metrics_range(uuid, date, date) to authenticated;
grant execute on function public.aggregate_daily_metrics_range(uuid, date, date) to service_role;
