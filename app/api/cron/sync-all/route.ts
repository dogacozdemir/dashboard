import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { runSyncAdPlatformForTenant, runSyncSEOForTenant } from '@/features/oauth/actions/syncPlatformData';
import { runGenerateGeoReportForTenant } from '@/features/strategy/actions/generateGeoReport';
import { detectAndNotifyAnomalies } from '@/lib/alerts/anomaly';
import { runTenantSiteCrawl } from '@/lib/ai/site-crawl';
import type { AdPlatform } from '@/features/oauth/types';

/**
 * Scheduled sync entrypoint (Vercel Cron, GitHub Actions, or manual curl).
 * Authorization: Authorization: Bearer <CRON_SECRET>
 *
 * Uses Node.js runtime: OAuth token decryption relies on Node `crypto` (AES-GCM).
 */
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get('authorization');

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: tenants, error: tErr } = await supabase.from('tenants').select('id, name, slug, is_demo, custom_domain').eq('is_active', true);
    if (tErr) {
      return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
    }

    const { data: accounts, error: aErr } = await supabase
      .from('ad_accounts')
      .select('tenant_id, platform')
      .eq('is_active', true);

    if (aErr) {
      return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
    }

    const summary: Record<
      string,
      {
        seo: Awaited<ReturnType<typeof runSyncSEOForTenant>>;
        geoAi: Awaited<ReturnType<typeof runGenerateGeoReportForTenant>>;
        ads: Record<string, { success: boolean; error?: string }>;
      }
    > = {};

    const runGeoAi = Boolean(process.env.DEEPSEEK_API_KEY);

    for (const row of tenants ?? []) {
      const tid   = row.id as string;
      const tname = (row as { name?: string }).name ?? 'Brand';
      const seo   = await runSyncSEOForTenant(tid, supabase);

      let geoAi: Awaited<ReturnType<typeof runGenerateGeoReportForTenant>> = {
        success: true,
        skipped: true,
      };
      if (runGeoAi) {
        try {
          geoAi = await runGenerateGeoReportForTenant(tid, tname, supabase);
        } catch (e) {
          geoAi = {
            success: false,
            error: e instanceof Error ? e.message : 'GEO AI failed',
          };
        }
      }

      const platforms = [
        ...new Set((accounts ?? []).filter((a) => a.tenant_id === tid).map((a) => a.platform as AdPlatform)),
      ];

      const ads: Record<string, { success: boolean; error?: string }> = {};
      for (const p of platforms) {
        ads[p] = await runSyncAdPlatformForTenant(tid, p, supabase);
      }

      // Proactive anomaly alerts on freshly synced paid data (skip demo tenants).
      const isDemo = Boolean((row as { is_demo?: boolean }).is_demo);
      if (!isDemo && platforms.length > 0) {
        try {
          await detectAndNotifyAnomalies(supabase, tid, tname, (row as { slug?: string }).slug ?? '');
        } catch (e) {
          console.error('[cron/sync-all] anomaly', tid, e instanceof Error ? e.message : e);
        }
      }

      // Keep MonoAI's per-tenant brand knowledge fresh: crawl the client's own site
      // into external_knowledge_chunks (throttled ~7 days; skips demo / no domain).
      if (!isDemo) {
        try {
          await runTenantSiteCrawl(supabase, tid, (row as { custom_domain?: string | null }).custom_domain ?? null);
        } catch (e) {
          console.error('[cron/sync-all] site-crawl', tid, e instanceof Error ? e.message : e);
        }
      }

      summary[tid] = { seo, geoAi, ads };
    }

    return NextResponse.json({
      ok:      true,
      tenants: tenants?.length ?? 0,
      summary,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Cron sync failed';
    console.error('[cron/sync-all]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
