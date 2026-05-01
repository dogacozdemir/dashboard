-- Organic (GSC) daily rollup + DeepSeek GEO AI reports + strategy log type

-- Paid + organic search metrics (GSC sync writes platform = organic)
alter table public.daily_metrics
  drop constraint if exists daily_metrics_platform_check;

alter table public.daily_metrics
  add constraint daily_metrics_platform_check
  check (platform in ('meta', 'google', 'tiktok', 'organic'));

-- GEO AI simulator rows (DeepSeek)
alter table public.geo_reports
  drop constraint if exists geo_reports_metric_source_check;

alter table public.geo_reports
  add constraint geo_reports_metric_source_check
  check (metric_source in ('geo_rank', 'gsc_query', 'geo_ai'));

create unique index if not exists idx_geo_reports_geo_ai_unique
  on public.geo_reports (tenant_id, keyword, engine)
  where metric_source = 'geo_ai';

-- Latest GEO strategy note for dashboard hero card
alter table public.strategy_logs
  drop constraint if exists strategy_logs_report_type_check;

alter table public.strategy_logs
  add constraint strategy_logs_report_type_check
  check (report_type in ('geo', 'seo', 'market_insight', 'geo_strategy'));
