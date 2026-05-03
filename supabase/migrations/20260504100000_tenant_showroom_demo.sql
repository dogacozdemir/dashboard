-- Showroom (demo) tenants: flag + canonical Madmonos Lux Cosmetics tenant.
alter table public.tenants
  add column if not exists is_demo boolean not null default false;

comment on column public.tenants.is_demo is
  'When true, dashboard reads mock showroom data instead of tenant analytics (no live API spend).';

insert into public.tenants (
  slug,
  name,
  industry,
  plan,
  is_active,
  is_demo,
  dashboard_goal,
  primary_color
)
values (
  'showroom',
  'Madmonos Lux Cosmetics',
  'Luxury Beauty',
  'enterprise',
  true,
  true,
  'awareness',
  '#bea042'
)
on conflict (slug) do update set
  name         = excluded.name,
  industry     = excluded.industry,
  is_demo      = excluded.is_demo,
  is_active    = excluded.is_active,
  plan         = excluded.plan,
  dashboard_goal = excluded.dashboard_goal,
  primary_color    = excluded.primary_color;
