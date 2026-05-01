-- Magic onboarding: primary growth goal + completion timestamp for tenant dashboard UX

alter table public.tenants
  add column if not exists dashboard_goal text;

alter table public.tenants
  add column if not exists magic_onboarding_completed_at timestamptz;

alter table public.tenants
  drop constraint if exists tenants_dashboard_goal_check;

alter table public.tenants
  add constraint tenants_dashboard_goal_check
  check (dashboard_goal is null or dashboard_goal in ('sales', 'awareness', 'cost'));

comment on column public.tenants.dashboard_goal is
  'Tenant-chosen dashboard emphasis: sales | awareness | cost (Magic Onboarding).';

comment on column public.tenants.magic_onboarding_completed_at is
  'When the tenant finished Magic Onboarding (goals step); null if never completed.';
