'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/auth/tenant-guard';
import type { TenantWithStats } from '../types';

const DEMO_TENANTS: TenantWithStats[] = [
  { id: '1', slug: 'acme', name: 'Acme Corp', logo_url: null, custom_domain: 'acme.madmonos.com', plan: 'enterprise', primary_color: '#6366F1', is_active: true, created_at: '2024-01-15T00:00:00Z', userCount: 5, assetCount: 24, campaignCount: 12, lastActivity: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: '2', slug: 'brand-x', name: 'Brand X', logo_url: null, custom_domain: null, plan: 'growth', primary_color: '#06B6D4', is_active: true, created_at: '2024-02-20T00:00:00Z', userCount: 3, assetCount: 11, campaignCount: 5, lastActivity: new Date(Date.now() - 1000 * 3600 * 3).toISOString() },
  { id: '3', slug: 'nova', name: 'Nova Digital', logo_url: null, custom_domain: 'nova.madmonos.com', plan: 'starter', primary_color: '#10B981', is_active: true, created_at: '2024-03-10T00:00:00Z', userCount: 2, assetCount: 4, campaignCount: 2, lastActivity: new Date(Date.now() - 1000 * 3600 * 24).toISOString() },
  { id: '4', slug: 'stealth', name: 'Stealth Brand', logo_url: null, custom_domain: null, plan: 'growth', primary_color: null, is_active: false, created_at: '2024-04-01T00:00:00Z', userCount: 1, assetCount: 0, campaignCount: 0, lastActivity: null },
];

export async function fetchAllTenants(): Promise<TenantWithStats[]> {
  await requireAdminSession();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, logo_url, custom_domain, plan, primary_color, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchAllTenants]', error.message);
    return DEMO_TENANTS;
  }

  if (data && data.length > 0) {
    return data.map((t) => ({
      ...t,
      plan: t.plan as TenantWithStats['plan'],
      userCount: 0,
      assetCount: 0,
      campaignCount: 0,
      lastActivity: null,
    }));
  }
  return DEMO_TENANTS;
}

export async function createTenant(data: {
  slug: string;
  name: string;
  plan: 'starter' | 'growth' | 'enterprise';
}): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('tenants').insert({
    slug: data.slug,
    name: data.name,
    plan: data.plan,
  });
  if (error) return { success: false, error: error.message };
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

  if (error) return { success: false, error: error.message };
  return { success: true };
}
