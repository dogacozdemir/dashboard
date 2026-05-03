import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import type { SessionUser } from '@/types/user';
import {
  fetchAggregateMetrics,
  fetchSpendChartData,
  type TimeRange,
} from '@/features/performance-hub/actions/fetchMetrics';
import { parseCockpitPlatform } from '@/features/performance-hub/lib/cockpit-platform';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { renderMonoReportPdf } from '@/features/mono-report/renderMonoReportPdf';
import { generateMonoReportNarrative } from '@/features/mono-report/generateMonoReportNarrative';
import { trackActivity } from '@/features/gamification/actions/trackActivity';

const RANGES = new Set<TimeRange>(['daily', 'weekly', 'monthly']);

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const rangeRaw = searchParams.get('range') ?? 'monthly';
    const range: TimeRange = RANGES.has(rangeRaw as TimeRange) ? (rangeRaw as TimeRange) : 'monthly';
    const cockpit = parseCockpitPlatform(searchParams.get('platform') ?? undefined);
    const locale = user.locale === 'en' ? 'en' : 'tr';

    let metrics;
    let chart;
    try {
      ;[metrics, chart] = await Promise.all([
        fetchAggregateMetrics(tenantId, range, cockpit),
        fetchSpendChartData(tenantId, range, cockpit),
      ]);
    } catch (e) {
      console.error('[mono-report] fetch metrics/chart failed', { tenantId: tenantId.slice(0, 8), range, cockpit }, e);
      return NextResponse.json({ error: 'Failed to load metrics' }, { status: 502 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: trow, error: tenantErr } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantErr) {
      console.error('[mono-report] tenant lookup', tenantErr.message);
    }
    const tenantName = String((trow as { name?: string } | null)?.name ?? 'Tenant');

    let narrative = '';
    try {
      narrative = await generateMonoReportNarrative({
        tenantName,
        range,
        cockpit,
        metrics,
        locale,
      });
    } catch (e) {
      console.error('[mono-report] narrative generation failed', e);
    }

    const poweredLine =
      locale === 'en'
        ? 'Powered by Madmonos · monoAI intelligence layer'
        : 'Madmonos tarafından güçlendirildi · monoAI zekâ katmanı';

    let bytes: Uint8Array;
    try {
      bytes = await renderMonoReportPdf({
        tenantName,
        range,
        cockpit,
        metrics,
        chart,
        narrative,
        poweredLine,
      });
    } catch (e) {
      console.error('[mono-report] PDF render failed', { tenantId: tenantId.slice(0, 8), range, cockpit }, e);
      return NextResponse.json({ error: 'PDF render failed' }, { status: 500 });
    }

    try {
      await trackActivity('pdf_generated');
    } catch {
      // non-fatal
    }

    const filename = `mono-report-${tenantId.slice(0, 8)}-${range}-${cockpit}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[mono-report] unhandled', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
