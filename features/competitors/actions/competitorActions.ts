'use server';

import { auth } from '@/lib/auth/config';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { requirePermission } from '@/lib/auth/permissions';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { trackCompetitor } from '@/lib/competitors/track';
import { summarizePriceDiff, type DetectedPrice } from '@/lib/competitors/price';
import { normalizeCompetitorUrl, deriveCompetitorName } from '../lib/competitor-url';
import type { Competitor } from '../types';
import type { SessionUser } from '@/types/user';

const MAX_COMPETITORS = 20;

type CompetitorRow = {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  last_checked_at: string | null;
  created_at: string;
};

type SnapshotRow = {
  competitor_id: string;
  changed: boolean;
  change_summary: string | null;
  fetched_at: string;
  prices: DetectedPrice[] | null;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Lists the tenant's competitors, each with its latest snapshot and change
 * count. Read-only; any tenant member may view.
 */
export async function fetchCompetitors(companyId: string): Promise<Competitor[]> {
  const validatedId = await requireTenantAction(companyId);
  const supabase = await createSupabaseServerClient();

  const { data: rows, error } = await supabase
    .from('competitors')
    .select('id, name, url, is_active, last_checked_at, created_at')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: true });

  if (error || !rows?.length) return [];

  const competitorRows = rows as CompetitorRow[];

  const { data: snaps } = await supabase
    .from('competitor_snapshots')
    .select('competitor_id, changed, change_summary, fetched_at, prices')
    .eq('tenant_id', validatedId)
    .order('fetched_at', { ascending: false });

  const snapRows = (snaps ?? []) as SnapshotRow[];
  // Latest few rows per competitor: [0]=latest, [1]=previous (price diff), and
  // the changed ones among them feed the visible history timeline.
  const byCompetitor = new Map<string, SnapshotRow[]>();
  const changeCounts = new Map<string, number>();
  for (const s of snapRows) {
    const list = byCompetitor.get(s.competitor_id) ?? [];
    if (list.length < 8) list.push(s);
    byCompetitor.set(s.competitor_id, list);
    if (s.changed) changeCounts.set(s.competitor_id, (changeCounts.get(s.competitor_id) ?? 0) + 1);
  }

  return competitorRows.map((c) => {
    const [latest, previous] = byCompetitor.get(c.id) ?? [];
    const prices = latest?.prices ?? [];
    return {
      id: c.id,
      name: c.name,
      url: c.url,
      host: hostOf(c.url),
      isActive: c.is_active,
      lastCheckedAt: c.last_checked_at,
      createdAt: c.created_at,
      latest: latest
        ? { changed: latest.changed, changeSummary: latest.change_summary, fetchedAt: latest.fetched_at }
        : null,
      changeCount: changeCounts.get(c.id) ?? 0,
      prices,
      priceChange:
        latest?.changed && previous ? summarizePriceDiff(previous.prices ?? [], prices) : null,
      history: (byCompetitor.get(c.id) ?? [])
        .filter((snap) => snap.changed)
        .slice(0, 5)
        .map((snap) => ({ fetchedAt: snap.fetched_at, changeSummary: snap.change_summary })),
    } satisfies Competitor;
  });
}

/**
 * Adds a competitor and captures its baseline snapshot immediately, so the card
 * shows content on the first render rather than "pending first check".
 */
export async function addCompetitor(
  companyId: string,
  input: { url: string; name?: string },
): Promise<{ success: boolean; error?: string; competitorId?: string }> {
  const validatedId = await requireTenantAction(companyId);
  await requirePermission('strategy.insight_write');

  const normalized = normalizeCompetitorUrl(input.url);
  if (!normalized) {
    return { success: false, error: 'Geçerli bir web adresi girin (örn. rakip.com).' };
  }

  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', validatedId);

  if ((count ?? 0) >= MAX_COMPETITORS) {
    return { success: false, error: `En fazla ${MAX_COMPETITORS} rakip takip edebilirsin.` };
  }

  const name = input.name?.trim() || deriveCompetitorName(normalized.host);

  const session = await auth();
  const userId = (session?.user as SessionUser | undefined)?.id ?? null;

  const { data: inserted, error } = await supabase
    .from('competitors')
    .insert({
      tenant_id: validatedId,
      name,
      url: normalized.url,
      created_by: userId,
    })
    .select('id, tenant_id, name, url')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Bu rakip zaten takip listende.' };
    }
    console.error('[addCompetitor]', error.message);
    return { success: false, error: 'Rakip eklenemedi.' };
  }

  // Baseline capture — best-effort; a failure here doesn't undo the add.
  try {
    await trackCompetitor(supabase, inserted as CompetitorRow & { tenant_id: string });
  } catch (e) {
    console.error('[addCompetitor] baseline', e);
  }

  return { success: true, competitorId: (inserted as { id: string }).id };
}

export async function removeCompetitor(
  companyId: string,
  competitorId: string,
): Promise<{ success: boolean; error?: string }> {
  const validatedId = await requireTenantAction(companyId);
  await requirePermission('strategy.insight_write');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', competitorId)
    .eq('tenant_id', validatedId);

  if (error) {
    console.error('[removeCompetitor]', error.message);
    return { success: false, error: 'Rakip kaldırılamadı.' };
  }
  return { success: true };
}

/**
 * Manual "check now" — runs a fresh crawl regardless of the throttle. Returns
 * what happened so the UI can surface it without a full refetch.
 */
export async function checkCompetitorNow(
  companyId: string,
  competitorId: string,
): Promise<{ success: boolean; status?: string; summary?: string | null; error?: string }> {
  const validatedId = await requireTenantAction(companyId);
  await requirePermission('strategy.insight_write');

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from('competitors')
    .select('id, tenant_id, name, url')
    .eq('id', competitorId)
    .eq('tenant_id', validatedId)
    .maybeSingle();

  if (error || !row) return { success: false, error: 'Rakip bulunamadı.' };

  const result = await trackCompetitor(supabase, row as CompetitorRow & { tenant_id: string });
  if (result.status === 'error') return { success: false, error: result.error };
  return {
    success: true,
    status: result.status,
    summary: result.status === 'changed' ? result.summary : null,
  };
}

/** Whether the current session may manage the watch list (add/remove/check). */
export async function canManageCompetitors(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  return sessionHasPermission(session.user as SessionUser, 'strategy.insight_write');
}
