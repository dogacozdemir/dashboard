'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { requirePermission } from '@/lib/auth/permissions';
import { decryptToken, encryptToken, packToken, unpackToken } from '@/lib/utils/crypto';
import type { AdPlatform } from '../types';
import { mapIntegrationSyncErrorForUser } from '@/lib/integrations/user-facing-errors';

const DATE_END = () => new Date().toISOString().split('T')[0];
const DATE_START_30 = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

type AdAccountRow = {
  access_token: string;
  iv: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
};

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function decryptAccessToken(account: AdAccountRow): string {
  try {
    const stored = JSON.parse(account.access_token) as { encrypted: string; iv: string; authTag: string };
    if (stored.encrypted && stored.iv && stored.authTag) {
      return decryptToken(stored);
    }
  } catch {
    /* fall through */
  }
  return decryptToken(unpackToken(account.access_token));
}

function decryptStoredRefreshToken(refreshPacked: string | null): string | null {
  if (!refreshPacked) return null;
  try {
    return decryptToken(unpackToken(refreshPacked));
  } catch {
    return null;
  }
}

async function refreshGoogleOAuthTokens(refreshTokenPlain: string): Promise<{
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}> {
  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? '';
  const res          = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshTokenPlain,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as { access_token: string; expires_in?: number; refresh_token?: string };
}

async function persistGoogleTokensAfterRefresh(
  supabase: SupabaseClient,
  tenantId: string,
  accessToken: string,
  refreshed: { expires_in?: number; refresh_token?: string },
) {
  const encAccess = encryptToken(accessToken);
  const updates: Record<string, unknown> = {
    access_token: packToken(encAccess),
    iv:           encAccess.iv,
    token_expires_at: refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      : null,
  };
  if (refreshed.refresh_token) {
    updates.refresh_token = packToken(encryptToken(refreshed.refresh_token));
  }
  await supabase
    .from('ad_accounts')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('platform', 'google')
    .eq('is_active', true);
}

/** Keeps Google Ads + Search Console calls alive using refresh_token until revocation. */
async function ensureGoogleAccessToken(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ accessToken: string } | { error: string }> {
  const account = await loadAdAccount(supabase, tenantId, 'google');
  if (!account) return { error: 'No active google ad account' };

  let accessToken = '';
  try {
    accessToken = decryptAccessToken(account);
  } catch {
    accessToken = '';
  }

  const refreshPlain = decryptStoredRefreshToken(account.refresh_token);
  const expiresMs    = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  const bufferMs     = 5 * 60 * 1000;
  const expiredByClock =
    expiresMs > 0 && Date.now() >= expiresMs - bufferMs;

  const lastSyncMs = account.last_synced_at ? new Date(account.last_synced_at).getTime() : 0;
  const staleUnknownExpiry =
    !account.token_expires_at &&
    lastSyncMs > 0 &&
    Date.now() - lastSyncMs > 50 * 60 * 1000;

  const shouldRefresh =
    Boolean(refreshPlain) && (!accessToken || expiredByClock || staleUnknownExpiry);

  if (shouldRefresh && refreshPlain) {
    try {
      const refreshed = await refreshGoogleOAuthTokens(refreshPlain);
      accessToken = refreshed.access_token;
      await persistGoogleTokensAfterRefresh(supabase, tenantId, accessToken, refreshed);
    } catch (e) {
      console.error('[ensureGoogleAccessToken] refresh failed', e);
      if (!accessToken) {
        return { error: e instanceof Error ? e.message : 'Google token refresh failed' };
      }
    }
  }

  if (!accessToken) return { error: 'Could not obtain Google access token' };
  return { accessToken };
}

async function loadAdAccount(
  supabase: SupabaseClient,
  tenantId: string,
  platform: AdPlatform
): Promise<AdAccountRow | null> {
  const { data, error } = await supabase
    .from('ad_accounts')
    .select('access_token, iv, refresh_token, token_expires_at, last_synced_at')
    .eq('tenant_id', tenantId)
    .eq('platform', platform)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as AdAccountRow;
}

async function touchAdAccountSync(supabase: SupabaseClient, tenantId: string, platform: AdPlatform) {
  await supabase
    .from('ad_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('platform', platform);
}

// ─── Meta (Facebook) Ads API ─────────────────────────────────────────────────

async function syncMeta(accessToken: string, tenantId: string, supabase: SupabaseClient): Promise<void> {
  const accountsRes = await fetch(
    `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
  );
  if (!accountsRes.ok) {
    const t = await accountsRes.text();
    throw new Error(`Meta: ad accounts ${accountsRes.status} ${t.slice(0, 200)}`);
  }
  const { data: accounts } = (await accountsRes.json()) as { data: Array<{ id: string; name: string }> };
  if (!accounts?.length) return;

  let wroteMetrics = false;

  for (const account of accounts) {
    const actId = account.id.startsWith('act_') ? account.id : `act_${account.id}`;

    const campaignsRes = await fetch(
      `https://graph.facebook.com/v18.0/${actId}/campaigns` +
        `?fields=id,name,status,objective` +
        `&access_token=${accessToken}` +
        `&limit=50`
    );
    if (campaignsRes.ok) {
      const { data: campaigns } = (await campaignsRes.json()) as {
        data: Array<{ id: string; name: string; status: string }>;
      };
      for (const campaign of campaigns ?? []) {
        await supabase.from('ad_campaigns').upsert(
          {
            tenant_id:     tenantId,
            platform:      'meta',
            campaign_name: campaign.name,
            data:          { status: campaign.status },
          },
          { onConflict: 'tenant_id,platform,campaign_name' }
        );
      }
    }

    const insightsRes = await fetch(
      `https://graph.facebook.com/v18.0/${actId}/insights` +
        `?fields=date_start,spend,impressions,clicks,actions,action_values,purchase_roas,ctr` +
        `&time_increment=1` +
        `&time_range={"since":"${DATE_START_30()}","until":"${DATE_END()}"}` +
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
        actions?: Array<{ action_type: string; value: string }>;
        action_values?: Array<{ action_type: string; value: string }>;
        purchase_roas?: Array<{ value: string }>;
        ctr: string;
      }>;
    };

    for (const row of insights ?? []) {
      let conversions = parseInt(row.conversions ?? '0', 10) || 0;
      if (conversions === 0) {
        for (const a of row.actions ?? []) {
          if (a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase') {
            conversions += parseInt(a.value, 10) || 0;
          }
        }
      }
      if (conversions === 0) {
        const convAct = row.actions?.find((a) => a.action_type === 'conversions');
        if (convAct) conversions = parseInt(convAct.value, 10) || 0;
      }

      const spend       = parseFloat(row.spend ?? '0');
      const impressions = parseInt(row.impressions ?? '0', 10);
      const clicks      = parseInt(row.clicks ?? '0', 10);
      let roas          = parseFloat(row.purchase_roas?.[0]?.value ?? '0');
      let revenue = 0;
      for (const av of row.action_values ?? []) {
        if (av.action_type === 'purchase' || av.action_type === 'offsite_conversion.fb_pixel_purchase') {
          revenue += parseFloat(av.value) || 0;
        }
      }
      if (revenue <= 0 && spend > 0 && roas > 0) revenue = spend * roas;
      if (roas <= 0 && spend > 0 && revenue > 0) roas = Math.round((revenue / spend) * 100) / 100;

      const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : parseFloat(row.ctr ?? '0') * (parseFloat(row.ctr ?? '0') <= 1 ? 100 : 1);

      const { error } = await supabase.from('daily_metrics').upsert(
        {
          tenant_id:   tenantId,
          date:        row.date_start,
          platform:    'meta',
          spend,
          impressions,
          clicks,
          conversions,
          roas:        Math.round(roas * 100) / 100,
          ctr:         Math.round(ctrPct * 10000) / 10000,
        },
        { onConflict: 'tenant_id,date,platform' }
      );
      if (!error) wroteMetrics = true;
    }
  }

  if (!wroteMetrics && accounts.length > 0) {
    console.warn('[syncMeta] no daily_metrics rows written');
  }
}

// ─── Google Ads API ──────────────────────────────────────────────────────────

async function syncGoogle(accessToken: string, tenantId: string, supabase: SupabaseClient): Promise<void> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '';
  if (!developerToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN is not set');

  const customersRes = await fetch('https://googleads.googleapis.com/v15/customers:listAccessibleCustomers', {
    headers: {
      Authorization:     `Bearer ${accessToken}`,
      'developer-token': developerToken,
    },
  });
  if (!customersRes.ok) {
    const t = await customersRes.text();
    throw new Error(`Google Ads: list customers ${customersRes.status} ${t.slice(0, 200)}`);
  }
  const { resourceNames } = (await customersRes.json()) as { resourceNames: string[] };
  if (!resourceNames?.length) return;

  let wrote = false;

  for (const resource of resourceNames) {
    const customerId = resource.replace('customers/', '');

    const gaql = `
      SELECT
        campaign.id, campaign.name, campaign.status,
        metrics.cost_micros, metrics.impressions, metrics.clicks,
        metrics.conversions, metrics.conversions_value, metrics.ctr,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${DATE_START_30()}' AND '${DATE_END()}'
      ORDER BY segments.date ASC
    `;

    const queryRes = await fetch(
      `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          Authorization:     `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type':    'application/json',
        },
        body: JSON.stringify({ query: gaql }),
      }
    );
    if (!queryRes.ok) continue;

    const { results = [] } = (await queryRes.json()) as { results: Array<Record<string, unknown>> };

    const dailyAgg: Record<
      string,
      { spend: number; impressions: number; clicks: number; conversions: number; convValue: number }
    > = {};

    type CampaignRollup = {
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      convValue: number;
      status: string;
    };
    const campaignRollup: Record<string, CampaignRollup> = {};

    for (const row of results) {
      const metrics  = row.metrics as Record<string, unknown> | undefined;
      const campaign = row.campaign as Record<string, string> | undefined;
      const segments = row.segments as Record<string, string> | undefined;
      const date     = segments?.date;
      if (!date || !campaign?.name) continue;

      const cSpend       = num(metrics?.costMicros) / 1_000_000;
      const cImpressions = num(metrics?.impressions);
      const cClicks      = num(metrics?.clicks);
      const cConversions = num(metrics?.conversions);
      const cConvVal     = num(metrics?.conversionsValue);

      if (!campaignRollup[campaign.name]) {
        campaignRollup[campaign.name] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          convValue: 0,
          status: campaign.status ?? 'UNKNOWN',
        };
      }
      const cr           = campaignRollup[campaign.name];
      cr.spend          += cSpend;
      cr.impressions    += cImpressions;
      cr.clicks         += cClicks;
      cr.conversions    += cConversions;
      cr.convValue      += cConvVal;
      cr.status          = campaign.status ?? cr.status;

      if (!dailyAgg[date]) {
        dailyAgg[date] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 };
      }
      dailyAgg[date].spend       += cSpend;
      dailyAgg[date].impressions += cImpressions;
      dailyAgg[date].clicks      += cClicks;
      dailyAgg[date].conversions += cConversions;
      dailyAgg[date].convValue   += cConvVal;
    }

    function mapGoogleCampaignStatus(s: string): 'active' | 'paused' | 'completed' {
      const u = s.toUpperCase();
      if (u === 'ENABLED') return 'active';
      if (u === 'PAUSED') return 'paused';
      return 'completed';
    }

    for (const [name, tot] of Object.entries(campaignRollup)) {
      const spend = tot.spend;
      const roas  = spend > 0 ? Math.round((tot.convValue / spend) * 100) / 100 : 0;
      const ctr   = tot.impressions > 0 ? (tot.clicks / tot.impressions) * 100 : 0;
      await supabase.from('ad_campaigns').upsert(
        {
          tenant_id:     tenantId,
          platform:      'google',
          campaign_name: name,
          data:          {
            status:      mapGoogleCampaignStatus(tot.status),
            spend:       Math.round(spend * 100) / 100,
            impressions: Math.round(tot.impressions),
            clicks:      Math.round(tot.clicks),
            conversions: Math.round(tot.conversions),
            roas,
            ctr:         Math.round(ctr * 10000) / 10000,
          },
        },
        { onConflict: 'tenant_id,platform,campaign_name' },
      );
    }

    for (const [date, agg] of Object.entries(dailyAgg)) {
      const spend = agg.spend;
      const roas  = spend > 0 ? Math.round((agg.convValue / spend) * 100) / 100 : 0;
      const ctr   = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;

      const { error } = await supabase.from('daily_metrics').upsert(
        {
          tenant_id:   tenantId,
          date,
          platform:    'google',
          spend:       Math.round(spend * 100) / 100,
          impressions: Math.round(agg.impressions),
          clicks:      Math.round(agg.clicks),
          conversions: Math.round(agg.conversions),
          roas,
          ctr:         Math.round(ctr * 10000) / 10000,
        },
        { onConflict: 'tenant_id,date,platform' }
      );
      if (!error) wrote = true;
    }
  }

  if (!wrote) console.warn('[syncGoogle] no daily_metrics rows written');
}

// ─── TikTok Ads API ──────────────────────────────────────────────────────────

async function syncTikTok(accessToken: string, tenantId: string, supabase: SupabaseClient): Promise<void> {
  const advertisersRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/', {
    headers: {
      'Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
  if (!advertisersRes.ok) {
    const t = await advertisersRes.text();
    throw new Error(`TikTok: advertisers ${advertisersRes.status} ${t.slice(0, 200)}`);
  }
  const { data: ttData } = (await advertisersRes.json()) as {
    data: { list: Array<{ advertiser_id: string; advertiser_name: string }> };
  };
  const list = ttData?.list ?? [];
  if (!list.length) return;

  let wrote = false;

  for (const advertiser of list) {
    const advertiserId = advertiser.advertiser_id;

    const reportRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/', {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        report_type:   'BASIC',
        dimensions:    ['stat_time_day'],
        metrics:       ['spend', 'impressions', 'clicks', 'conversion', 'purchase_roas', 'ctr'],
        start_date:    DATE_START_30(),
        end_date:      DATE_END(),
        page_size:     100,
      }),
    });
    if (!reportRes.ok) continue;

    const { data: reportData } = (await reportRes.json()) as {
      data: { list: Array<{ dimensions: { stat_time_day: string }; metrics: Record<string, string> }> };
    };

    for (const row of reportData?.list ?? []) {
      const date    = row.dimensions.stat_time_day;
      const metrics = row.metrics;
      const spend       = parseFloat(metrics.spend ?? '0');
      const impressions = parseInt(metrics.impressions ?? '0', 10);
      const clicks      = parseInt(metrics.clicks ?? '0', 10);
      const conversions = parseInt(metrics.conversion ?? metrics.conversions ?? '0', 10);
      let roas          = parseFloat(metrics.purchase_roas ?? '0');
      const ctrRaw      = parseFloat(metrics.ctr ?? '0');
      const ctrPct      = ctrRaw <= 1 ? ctrRaw * 100 : ctrRaw;
      const revenue     = spend > 0 && roas > 0 ? spend * roas : 0;
      if (roas <= 0 && spend > 0 && revenue > 0) roas = Math.round((revenue / spend) * 100) / 100;

      const { error } = await supabase.from('daily_metrics').upsert(
        {
          tenant_id:   tenantId,
          date,
          platform:    'tiktok',
          spend,
          impressions,
          clicks,
          conversions,
          roas:        Math.round(roas * 100) / 100,
          ctr:         Math.round(ctrPct * 10000) / 10000,
        },
        { onConflict: 'tenant_id,date,platform' }
      );
      if (!error) wrote = true;
    }
  }

  if (!wrote) console.warn('[syncTikTok] no daily_metrics rows written');
}

// ─── Google Search Console ───────────────────────────────────────────────────

type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

async function syncGSCDataWithSupabase(
  tenantId: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const account = await loadAdAccount(supabase, tenantId, 'google');
  if (!account) {
    return { success: true, skipped: true };
  }

  const tokenResult = await ensureGoogleAccessToken(supabase, tenantId);
  if ('error' in tokenResult) {
    return { success: false, error: tokenResult.error };
  }
  const accessToken = tokenResult.accessToken;

  try {
    const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!sitesRes.ok) {
      const t = await sitesRes.text();
      return { success: false, error: `GSC sites ${sitesRes.status}: ${t.slice(0, 180)}` };
    }
    const sitesJson = (await sitesRes.json()) as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
    const entries   = sitesJson.siteEntry ?? [];
    const siteUrls    = entries.filter((s) => s.permissionLevel !== 'siteUnverified').map((s) => s.siteUrl);
    if (!siteUrls.length) {
      return { success: true, skipped: true };
    }

    const startDate = DATE_START_30();
    const endDate   = DATE_END();

    await supabase.from('geo_reports').delete().eq('tenant_id', tenantId).eq('metric_source', 'gsc_query');
    await supabase.from('gsc_page_analytics').delete().eq('tenant_id', tenantId);

    let gscWrote = false;
    const organicByDate: Record<string, { clicks: number; impressions: number; posSum: number; posW: number }> = {};

    for (const siteUrl of siteUrls) {
      const encSite = encodeURIComponent(siteUrl);

      const dateRes = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encSite}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['date'],
            rowLimit:   100,
          }),
        }
      );
      if (dateRes.ok) {
        const dJson = (await dateRes.json()) as { rows?: GscRow[] };
        for (const r of dJson.rows ?? []) {
          const d = r.keys?.[0];
          if (!d) continue;
          if (!organicByDate[d]) organicByDate[d] = { clicks: 0, impressions: 0, posSum: 0, posW: 0 };
          const im = r.impressions ?? 0;
          organicByDate[d].clicks      += r.clicks ?? 0;
          organicByDate[d].impressions += im;
          organicByDate[d].posSum      += (r.position ?? 0) * im;
          organicByDate[d].posW        += im;
        }
      }

      const queryBody = {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit:   25000,
      };
      const qRes = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encSite}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(queryBody),
        }
      );
      if (!qRes.ok) continue;
      const qJson = (await qRes.json()) as { rows?: GscRow[] };
      for (const r of qJson.rows ?? []) {
        const rawQ  = r.keys?.[0] ?? '(not set)';
        const query = `${siteUrl} · ${rawQ}`.slice(0, 500);
        const clicks      = r.clicks ?? 0;
        const impressions = r.impressions ?? 0;
        const ctr         = r.ctr ?? 0;
        const position    = r.position ?? 0;

        const { error: insErr } = await supabase.from('geo_reports').insert({
          tenant_id:     tenantId,
          keyword:       query,
          engine:        'google',
          metric_source: 'gsc_query',
          rank_data:     {
            source:          'gsc',
            siteUrl,
            query:           rawQ,
            cited:           false,
            position:        Math.round(position * 10) / 10,
            citationSource:  null,
            snippet:         null,
            clicks,
            impressions,
            ctr:             ctr <= 1 ? ctr * 100 : ctr,
          },
        });
        if (!insErr) gscWrote = true;
      }

      const pageBody = {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit:   25000,
      };
      const pRes = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encSite}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pageBody),
        }
      );
      if (!pRes.ok) continue;
      const pJson = (await pRes.json()) as { rows?: GscRow[] };
      for (const r of pJson.rows ?? []) {
        const pageUrl     = r.keys?.[0] ?? '';
        if (!pageUrl) continue;
        const clicks      = r.clicks ?? 0;
        const impressions = r.impressions ?? 0;
        const ctr         = r.ctr ?? 0;
        const position    = r.position ?? 0;
        const ctrPct      = ctr <= 1 ? ctr * 100 : ctr;

        const { error: pageErr } = await supabase.from('gsc_page_analytics').upsert(
          {
            tenant_id:   tenantId,
            page_url:    pageUrl.slice(0, 2048),
            clicks,
            impressions,
            ctr:         Math.round(ctrPct * 1000000) / 1000000,
            position:    Math.round(position * 1000) / 1000,
            synced_at:   new Date().toISOString(),
          },
          { onConflict: 'tenant_id,page_url' }
        );
        if (!pageErr) gscWrote = true;
      }
    }

    for (const [date, agg] of Object.entries(organicByDate)) {
      if (agg.impressions <= 0 && agg.clicks <= 0) continue;
      const im  = agg.impressions;
      const ctr = im > 0 ? (agg.clicks / im) * 100 : 0;
      const { error: orgErr } = await supabase.from('daily_metrics').upsert(
        {
          tenant_id:   tenantId,
          date,
          platform:    'organic',
          spend:       0,
          impressions: im,
          clicks:      agg.clicks,
          conversions: 0,
          roas:        0,
          ctr:         Math.round(ctr * 10000) / 10000,
        },
        { onConflict: 'tenant_id,date,platform' }
      );
      if (!orgErr) gscWrote = true;
    }

    if (gscWrote) {
      await touchAdAccountSync(supabase, tenantId, 'google');
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GSC sync failed';
    console.error('[syncGSC]', message);
    return { success: false, error: message };
  }
}

/** Simulated PageSpeed/Lighthouse-style CWV snapshot → technical_logs (SSOT for rings when no manual SEO payload). */
async function simulatePagespeedTechnicalLog(tenantId: string, supabase: SupabaseClient) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('technical_logs')
    .select('metadata')
    .eq('tenant_id', tenantId)
    .gte('created_at', dayAgo)
    .order('created_at', { ascending: false })
    .limit(40);
  const already = (recent ?? []).some(
    (r) => (r.metadata as Record<string, unknown> | null)?.source === 'pagespeed_simulation'
  );
  if (already) return;

  const jitter = () => 0.92 + Math.random() * 0.12;
  const lcp    = Math.round((2.2 * jitter()) * 100) / 100;
  const fid    = Math.round(65 + Math.random() * 40);
  const cls    = Math.round((0.04 + Math.random() * 0.06) * 1000) / 1000;

  await supabase.from('technical_logs').insert({
    tenant_id:   tenantId,
    type:        'system',
    description: `Core Web Vitals snapshot (simulated PageSpeed pipeline) · LCP ${lcp}s, FID ${fid}ms, CLS ${cls}`,
    metadata:    {
      source:       'pagespeed_simulation',
      simulated:    true,
      lcp:          lcp,
      lcpSeconds:   lcp,
      fid:          fid,
      fidMs:        fid,
      cls:          cls,
      generated_at: new Date().toISOString(),
    },
  });
}

// ─── Public: SEO wrapper (GSC + simulated CWV log) ───────────────────────────

export async function syncGSCData(tenantId: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  await requireTenantAction(tenantId);
  const supabase = await createSupabaseServerClient();
  const res = await syncGSCDataWithSupabase(tenantId, supabase);
  if (res.error) {
    console.error('[syncGSCData] raw:', res.error);
    return { ...res, error: await mapIntegrationSyncErrorForUser(res.error) };
  }
  return res;
}

export async function syncSEO(tenantId: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  await requireTenantAction(tenantId);
  const supabase = await createSupabaseServerClient();
  const gsc = await syncGSCDataWithSupabase(tenantId, supabase);
  try {
    await simulatePagespeedTechnicalLog(tenantId, supabase);
  } catch (e) {
    console.error('[syncSEO] pagespeed sim', e);
  }
  if (gsc.error) {
    console.error('[syncSEO] gsc raw:', gsc.error);
    return { ...gsc, error: await mapIntegrationSyncErrorForUser(gsc.error) };
  }
  return gsc;
}

/** Cron / admin: no session guard. */
export async function runSyncSEOForTenant(tenantId: string, supabase: SupabaseClient) {
  const gsc = await syncGSCDataWithSupabase(tenantId, supabase);
  try {
    await simulatePagespeedTechnicalLog(tenantId, supabase);
  } catch (e) {
    console.error('[runSyncSEOForTenant] pagespeed sim', e);
  }
  return gsc;
}

export async function runSyncAdPlatformForTenant(
  tenantId: string,
  platform: AdPlatform,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  let accessToken: string;

  if (platform === 'google') {
    const tokenResult = await ensureGoogleAccessToken(supabase, tenantId);
    if ('error' in tokenResult) {
      return { success: false, error: tokenResult.error };
    }
    accessToken = tokenResult.accessToken;
  } else {
    const account = await loadAdAccount(supabase, tenantId, platform);
    if (!account) {
      return { success: false, error: `No active ${platform} ad account` };
    }
    try {
      accessToken = decryptAccessToken(account);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Decrypt failed' };
    }
  }

  try {
    if (platform === 'meta') await syncMeta(accessToken, tenantId, supabase);
    if (platform === 'google') await syncGoogle(accessToken, tenantId, supabase);
    if (platform === 'tiktok') await syncTikTok(accessToken, tenantId, supabase);

    await touchAdAccountSync(supabase, tenantId, platform);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync error';
    console.error(`[runSyncAdPlatformForTenant][${platform}]`, message);
    return { success: false, error: message };
  }
}

export async function syncAdPlatform(
  tenantId: string,
  platform: AdPlatform
): Promise<{ success: boolean; error?: string }> {
  await requireTenantAction(tenantId);
  await requirePermission('integrations.manage');
  const supabase = await createSupabaseServerClient();
  const res = await runSyncAdPlatformForTenant(tenantId, platform, supabase);
  if (!res.success && res.error) {
    console.error(`[syncAdPlatform][${platform}]`, res.error);
    return { success: false, error: await mapIntegrationSyncErrorForUser(res.error) };
  }
  return res;
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
