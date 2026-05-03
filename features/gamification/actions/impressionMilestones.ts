'use server';

import { auth } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isDemoTenant } from '@/lib/demo/is-demo-tenant';
import type { GamificationTrackResult } from '../types';
import { trackActivity } from './trackActivity';

const empty: GamificationTrackResult = {
  newAchievements: [],
  leveledUp:       null,
  xpGained:        0,
  totalXP:         0,
};

/**
 * Awards `reach_100k` when tenant lifetime impressions (daily_metrics) ≥ 100k.
 * Call once per meaningful surface (dashboard load, post-sync); idempotent.
 */
export async function evaluateImpressionMilestone(tenantId: string): Promise<GamificationTrackResult> {
  const session = await auth();
  if (!session?.user) return empty;

  if (await isDemoTenant(tenantId)) return empty;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('tenant_total_impressions', { p_tenant_id: tenantId });
  if (error) {
    console.warn('[evaluateImpressionMilestone]', error.message);
    return empty;
  }

  const total =
    typeof data === 'bigint'
      ? Number(data)
      : typeof data === 'string'
        ? parseFloat(data)
        : Number(data);

  if (!Number.isFinite(total) || total < 100_000) return empty;

  return trackActivity('milestone_impressions_check', { totalLifetimeImpressions: total });
}
