'use server';

import { getPremiumAdminActionError } from '@/lib/copy/premium-copy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdminSession } from '@/lib/auth/tenant-guard';
import type { TenantWithStats } from '../types';
import type { AdminOverviewStats, PlatformHealth } from '../types/admin-overview';
import { normalizeTenantSlug, tenantSlugIssue } from '../lib/tenant-slug';
import { customDomainIssue, normalizeCustomDomainInput } from '../lib/custom-domain';

function aggregateLastActivity(
  tenantId: string,
  assetTimes: Map<string, string[]>,
  campaignTimes: Map<string, string[]>
): string | null {
  const a = assetTimes.get(tenantId) ?? [];
  const c = campaignTimes.get(tenantId) ?? [];
  const all = [...a, ...c].sort();
  return all.length ? all[all.length - 1] : null;
}

export async function fetchAllTenants(): Promise<TenantWithStats[]> {
  await requireAdminSession();

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    admin = null;
  }

  const supabase = admin ?? (await createSupabaseServerClient());

  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, logo_url, custom_domain, plan, primary_color, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchAllTenants]', error.message);
    return [];
  }

  if (!data?.length) return [];

  if (!admin) {
    return data.map((t) => ({
      ...t,
      plan: t.plan as TenantWithStats['plan'],
      userCount: 0,
      assetCount: 0,
      campaignCount: 0,
      lastActivity: null,
    }));
  }

  const [{ data: userRows }, { data: assetRows }, { data: campaignRows }] = await Promise.all([
    admin.from('users').select('tenant_id'),
    admin.from('creative_posts').select('tenant_id, created_at'),
    admin.from('ad_campaigns').select('tenant_id, synced_at'),
  ]);

  const userCount = new Map<string, number>();
  for (const r of userRows ?? []) {
    const tid = r.tenant_id as string;
    userCount.set(tid, (userCount.get(tid) ?? 0) + 1);
  }

  const assetCount = new Map<string, number>();
  const assetTimes = new Map<string, string[]>();
  for (const r of assetRows ?? []) {
    const tid = r.tenant_id as string;
    assetCount.set(tid, (assetCount.get(tid) ?? 0) + 1);
    if (r.created_at) {
      const arr = assetTimes.get(tid) ?? [];
      arr.push(r.created_at as string);
      assetTimes.set(tid, arr);
    }
  }

  const campaignCount = new Map<string, number>();
  const campaignTimes = new Map<string, string[]>();
  for (const r of campaignRows ?? []) {
    const tid = r.tenant_id as string;
    campaignCount.set(tid, (campaignCount.get(tid) ?? 0) + 1);
    if (r.synced_at) {
      const arr = campaignTimes.get(tid) ?? [];
      arr.push(r.synced_at as string);
      campaignTimes.set(tid, arr);
    }
  }

  return data.map((t) => ({
    ...t,
    plan: t.plan as TenantWithStats['plan'],
    userCount: userCount.get(t.id) ?? 0,
    assetCount: assetCount.get(t.id) ?? 0,
    campaignCount: campaignCount.get(t.id) ?? 0,
    lastActivity: aggregateLastActivity(t.id, assetTimes, campaignTimes),
  }));
}

export async function createTenant(data: {
  slug: string;
  name: string;
  plan: 'starter' | 'growth' | 'enterprise';
}): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();

  const name = data.name.trim();
  if (name.length < 2) {
    return { success: false, error: 'INVALID_NAME' };
  }

  const slug = normalizeTenantSlug(data.slug);
  const slugErr = tenantSlugIssue(slug);
  if (slugErr) {
    return { success: false, error: `SLUG_${slugErr.toUpperCase()}` };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('tenants').insert({
    slug,
    name,
    plan: data.plan,
    is_active: true,
  });

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'SLUG_TAKEN' };
    }
    console.error('[createTenant]', error.message);
    return { success: false, error: await getPremiumAdminActionError() };
  }
  return { success: true };
}

export async function toggleTenantStatus(
  tenantId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('tenants')
    .update({ is_active: isActive })
    .eq('id', tenantId);

  if (error) return { success: false, error: await getPremiumAdminActionError() };
  return { success: true };
}

export async function updateTenantCustomDomain(
  tenantId: string,
  rawDomain: string,
): Promise<{ success: boolean; error?: string; customDomain: string | null }> {
  await requireAdminSession();

  const normalized = normalizeCustomDomainInput(rawDomain);
  const issue = customDomainIssue(normalized);
  if (issue) {
    return { success: false, error: 'DOMAIN_INVALID', customDomain: null };
  }

  const customDomain = normalized.length > 0 ? normalized : null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('tenants')
    .update({ custom_domain: customDomain })
    .eq('id', tenantId);

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'DOMAIN_TAKEN', customDomain: null };
    }
    console.error('[updateTenantCustomDomain]', error.message);
    return { success: false, error: await getPremiumAdminActionError(), customDomain: null };
  }

  return { success: true, customDomain };
}

export type { AdminOverviewStats, PlatformHealth } from '../types/admin-overview';

function healthFromLastSync(iso: string | null): PlatformHealth {
  if (!iso) return 'err';
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 24) return 'ok';
  if (h < 168) return 'warn';
  return 'err';
}

/** Super-admin home: aggregate counts for control center (service role when available). */
export async function fetchAdminOverview(): Promise<AdminOverviewStats> {
  await requireAdminSession();

  const empty: AdminOverviewStats = {
    totalTenants:        0,
    activeTenants:       0,
    inactiveTenants:     0,
    recentSyncs24h:      0,
    totalManagedAssets:  0,
    totalCampaignRows:   0,
    totalSpend30d:       0,
    platformHealth:      { meta: 'warn', google: 'warn', tiktok: 'warn' },
    healthScoreDisplay:  99.0,
  };

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return empty;
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [
    { count: totalTenants },
    { count: activeTenants },
    { data: spendRows },
    { count: syncCount },
    { count: assetCount },
    { count: campaignCount },
    { data: acctRows },
  ] = await Promise.all([
    admin.from('tenants').select('id', { count: 'exact', head: true }),
    admin.from('tenants').select('id', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('daily_metrics').select('spend').gte('date', since30d),
    admin.from('ad_accounts').select('id', { count: 'exact', head: true }).gte('last_synced_at', since24h),
    admin.from('creative_posts').select('id', { count: 'exact', head: true }),
    admin.from('ad_campaigns').select('id', { count: 'exact', head: true }),
    admin.from('ad_accounts').select('platform, last_synced_at').eq('is_active', true),
  ]);

  const total = totalTenants ?? 0;
  const active = activeTenants ?? 0;
  const spend = (spendRows ?? []).reduce((s, r) => s + Number((r as { spend?: unknown }).spend ?? 0), 0);

  const byPl: Record<'meta' | 'google' | 'tiktok', string | null> = {
    meta: null,
    google: null,
    tiktok: null,
  };
  for (const r of acctRows ?? []) {
    const row = r as { platform: string; last_synced_at: string | null };
    const p = row.platform;
    if (p !== 'meta' && p !== 'google' && p !== 'tiktok') continue;
    const t = row.last_synced_at;
    if (!t) continue;
    const cur = byPl[p];
    if (!cur || t > cur) byPl[p] = t;
  }

  const platformHealth = {
    meta:   healthFromLastSync(byPl.meta ?? null),
    google: healthFromLastSync(byPl.google ?? null),
    tiktok: healthFromLastSync(byPl.tiktok ?? null),
  };

  const flags = [platformHealth.meta, platformHealth.google, platformHealth.tiktok];
  const errN  = flags.filter((x) => x === 'err').length;
  const warnN = flags.filter((x) => x === 'warn').length;
  const healthScoreDisplay = Math.max(
    94,
    Math.min(99.9, 99.9 - errN * 2.5 - warnN * 0.8 + (active > 0 ? 0.2 : 0)),
  );

  return {
    totalTenants:       total,
    activeTenants:      active,
    inactiveTenants:    Math.max(0, total - active),
    recentSyncs24h:     syncCount ?? 0,
    totalManagedAssets: assetCount ?? 0,
    totalCampaignRows:  campaignCount ?? 0,
    totalSpend30d:      spend,
    platformHealth,
    healthScoreDisplay: Math.round(healthScoreDisplay * 10) / 10,
  };
}
