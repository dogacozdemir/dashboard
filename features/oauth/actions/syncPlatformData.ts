'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { decryptToken, unpackToken } from '@/lib/utils/crypto';
import type { AdPlatform } from '../types';

const THIRTY_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

// ─── Meta (Facebook) Ads API ─────────────────────────────────────────────────

async function syncMeta(accessToken: string, tenantId: string): Promise<void> {
  // 1. Fetch ad accounts
  const accountsRes = await fetch(
    `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
  );
  if (!accountsRes.ok) throw new Error('Meta: failed to fetch ad accounts');
  const { data: accounts } = (await accountsRes.json()) as { data: Array<{ id: string; name: string }> };

  const supabase = await createSupabaseServerClient();

  for (const account of accounts) {
    const actId = account.id.startsWith('act_') ? account.id : `act_${account.id}`;

    // 2. Fetch campaigns
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v18.0/${actId}/campaigns` +
        `?fields=id,name,status,objective` +
        `&access_token=${accessToken}` +
        `&limit=50`
    );
    if (!campaignsRes.ok) continue;
    const { data: campaigns } = (await campaignsRes.json()) as { data: Array<{ id: string; name: string; status: string }> };

    for (const campaign of campaigns) {
      await supabase.from('ad_campaigns').upsert({
        tenant_id:     tenantId,
        platform:      'meta',
        campaign_name: campaign.name,
        data: { status: campaign.status },
      }, { onConflict: 'tenant_id,platform,campaign_name' });
    }

    // 3. Fetch daily insights for last 30 days
    const insightsRes = await fetch(
      `https://graph.facebook.com/v18.0/${actId}/insights` +
        `?fields=date_start,spend,impressions,clicks,conversions,purchase_roas,ctr` +
        `&time_increment=1` +
        `&time_range={"since":"${THIRTY_DAYS_AGO()}","until":"${new Date().toISOString().split('T')[0]}"}` +
        `&access_token=${accessToken}` +
        `&limit=90`
    );
    if (!insightsRes.ok) continue;
    const { data: insights } = (await insightsRes.json()) as {
      data: Array<{
        date_start: string;
        spend: string;
        impressions: string;
        clicks: string;
        conversions?: string;
        purchase_roas?: Array<{ value: string }>;
        ctr: string;
      }>;
    };

    for (const row of insights) {
      const conversions = parseInt(row.conversions ?? '0', 10);
      const clicks      = parseInt(row.clicks, 10);
      await supabase.from('daily_metrics').upsert({
        tenant_id:   tenantId,
        date:        row.date_start,
        platform:    'meta',
        spend:       parseFloat(row.spend),
        impressions: parseInt(row.impressions, 10),
        clicks,
        conversions,
        roas:        parseFloat(row.purchase_roas?.[0]?.value ?? '0'),
        ctr:         parseFloat(row.ctr),
      }, { onConflict: 'tenant_id,date,platform' });
    }
  }
}

// ─── Google Ads API ──────────────────────────────────────────────────────────

async function syncGoogle(accessToken: string, tenantId: string): Promise<void> {
  // Google Ads API uses GAQL (Google Ads Query Language)
  // Requires developer-token in header
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '';

  // Fetch accessible customers first
  const customersRes = await fetch(
    'https://googleads.googleapis.com/v15/customers:listAccessibleCustomers',
    {
      headers: {
        Authorization:    `Bearer ${accessToken}`,
        'developer-token': developerToken,
      },
    }
  );
  if (!customersRes.ok) throw new Error('Google: failed to list customers');
  const { resourceNames } = (await customersRes.json()) as { resourceNames: string[] };

  const supabase = await createSupabaseServerClient();

  for (const resource of resourceNames) {
    const customerId = resource.replace('customers/', '');

    // Query campaign + metric data
    const gaql = `
      SELECT
        campaign.id, campaign.name, campaign.status,
        metrics.cost_micros, metrics.impressions, metrics.clicks,
        metrics.conversions, metrics.all_conversions_value,
        metrics.ctr, segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${THIRTY_DAYS_AGO()}' AND '${new Date().toISOString().split('T')[0]}'
      ORDER BY segments.date ASC
    `;

    const queryRes = await fetch(
      `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          Authorization:    `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type':   'application/json',
        },
        body: JSON.stringify({ query: gaql }),
      }
    );
    if (!queryRes.ok) continue;

    const { results = [] } = (await queryRes.json()) as { results: Array<Record<string, unknown>> };

    const dailyAgg: Record<string, { spend: number; impressions: number; clicks: number; conversions: number; ctr: number }> = {};

    for (const row of results) {
      const metrics  = row.metrics as Record<string, number>;
      const campaign = row.campaign as Record<string, string>;
      const segments = row.segments as Record<string, string>;
      const date     = segments.date;

      await supabase.from('ad_campaigns').upsert({
        tenant_id:     tenantId,
        platform:      'google',
        campaign_name: campaign.name,
        data:          { status: campaign.status },
      }, { onConflict: 'tenant_id,platform,campaign_name' });

      if (!dailyAgg[date]) dailyAgg[date] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0 };
      dailyAgg[date].spend       += (metrics.costMicros ?? 0) / 1_000_000;
      dailyAgg[date].impressions += metrics.impressions ?? 0;
      dailyAgg[date].clicks      += metrics.clicks ?? 0;
      dailyAgg[date].conversions += metrics.conversions ?? 0;
      dailyAgg[date].ctr          = (metrics.ctr ?? 0) * 100;
    }

    for (const [date, agg] of Object.entries(dailyAgg)) {
      const roas = agg.spend > 0 ? (agg.conversions * 50) / agg.spend : 0; // rough estimate
      await supabase.from('daily_metrics').upsert({
        tenant_id:   tenantId,
        date,
        platform:    'google',
        spend:       agg.spend,
        impressions: agg.impressions,
        clicks:      agg.clicks,
        conversions: agg.conversions,
        roas:        Math.round(roas * 100) / 100,
        ctr:         agg.ctr,
      }, { onConflict: 'tenant_id,date,platform' });
    }
  }
}

// ─── TikTok Ads API ──────────────────────────────────────────────────────────

async function syncTikTok(accessToken: string, tenantId: string): Promise<void> {
  // Fetch advertiser accounts
  const advertisersRes = await fetch(
    'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
    {
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!advertisersRes.ok) throw new Error('TikTok: failed to fetch advertisers');
  const { data: ttData } = (await advertisersRes.json()) as {
    data: { list: Array<{ advertiser_id: string; advertiser_name: string }> };
  };

  const supabase = await createSupabaseServerClient();

  for (const advertiser of ttData.list ?? []) {
    const advertiserId = advertiser.advertiser_id;

    const reportRes = await fetch(
      'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/',
      {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          report_type:   'BASIC',
          dimensions:    ['stat_time_day'],
          metrics:       ['spend', 'impressions', 'clicks', 'conversions', 'purchase_roas', 'ctr'],
          start_date:    THIRTY_DAYS_AGO(),
          end_date:      new Date().toISOString().split('T')[0],
          page_size:     100,
        }),
      }
    );
    if (!reportRes.ok) continue;

    const { data: reportData } = (await reportRes.json()) as {
      data: { list: Array<{ dimensions: { stat_time_day: string }; metrics: Record<string, string> }> };
    };

    for (const row of reportData.list ?? []) {
      const date    = row.dimensions.stat_time_day;
      const metrics = row.metrics;
      await supabase.from('daily_metrics').upsert({
        tenant_id:   tenantId,
        date,
        platform:    'tiktok',
        spend:       parseFloat(metrics.spend ?? '0'),
        impressions: parseInt(metrics.impressions ?? '0', 10),
        clicks:      parseInt(metrics.clicks ?? '0', 10),
        conversions: parseInt(metrics.conversions ?? '0', 10),
        roas:        parseFloat(metrics.purchase_roas ?? '0'),
        ctr:         parseFloat(metrics.ctr ?? '0'),
      }, { onConflict: 'tenant_id,date,platform' });
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function syncAdPlatform(
  tenantId: string,
  platform: AdPlatform
): Promise<{ success: boolean; error?: string }> {
  await requireTenantAction(tenantId);
  const supabase = await createSupabaseServerClient();

  const { data: account, error } = await supabase
    .from('ad_accounts')
    .select('access_token, iv, refresh_token')
    .eq('tenant_id', tenantId)
    .eq('platform', platform)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !account) {
    return { success: false, error: 'No active account found for this platform' };
  }

  let accessToken: string;
  try {
    const packed = JSON.stringify({ encrypted: account.access_token, iv: account.iv, authTag: '' });
    const stored = JSON.parse(account.access_token) as { encrypted: string; iv: string; authTag: string };
    void packed;
    accessToken = decryptToken(stored);
  } catch {
    accessToken = decryptToken(unpackToken(account.access_token));
  }

  try {
    if (platform === 'meta')   await syncMeta(accessToken, tenantId);
    if (platform === 'google') await syncGoogle(accessToken, tenantId);
    if (platform === 'tiktok') await syncTikTok(accessToken, tenantId);

    await supabase
      .from('ad_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('platform', platform);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.error(`[syncAdPlatform][${platform}]`, message);
    return { success: false, error: message };
  }
}

export async function getConnectedAccounts(tenantId: string) {
  await requireTenantAction(tenantId);
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('ad_accounts')
    .select('id, platform, account_name, is_active, last_synced_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  return data ?? [];
}
