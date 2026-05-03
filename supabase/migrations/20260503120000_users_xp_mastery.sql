-- Canonical XP on users (action + achievement grants update this column).
alter table public.users
  add column if not exists xp integer not null default 0;

-- One-time backfill: sum XP from earned achievements (matches ACHIEVEMENT_DEFS in app).
update public.users u
set xp = coalesce(
  (
    select sum(
      case ua.achievement_key
        when 'first_login' then 50
        when 'first_upload' then 100
        when 'first_approval' then 100
        when 'first_revision' then 75
        when 'quick_approver' then 150
        when 'approval_10' then 300
        when 'streak_3' then 100
        when 'streak_7' then 250
        when 'streak_30' then 1000
        when 'ai_explorer' then 75
        when 'ai_power_user' then 300
        when 'first_pdf' then 150
        when 'brand_milestone_logo' then 40
        when 'brand_milestone_guidelines' then 40
        when 'brand_milestone_palette' then 40
        when 'brand_milestone_fonts' then 40
        when 'brand_builder_50' then 200
        when 'brand_builder_100' then 500
        when 'calendar_pro' then 200
        when 'reach_100k' then 400
        else 0
      end
    )
    from public.user_achievements ua
    where ua.user_id = u.id
  ),
  0
);

comment on column public.users.xp is 'Total gamification XP (actions + badge bonuses).';
