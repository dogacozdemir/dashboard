-- Enables Supabase upsert on (tenant_id, platform, campaign_name)
create unique index if not exists idx_ad_campaigns_tenant_platform_name
  on public.ad_campaigns (tenant_id, platform, campaign_name);
