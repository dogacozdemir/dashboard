import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { buildTenantDigest } from '@/lib/digest/weekly-digest';
import { sendEmail } from '@/lib/email/send';
import { weeklyDigestEmail } from '@/lib/email/templates';
import { getTenantDashboardUrl } from '@/lib/utils/tenant-urls';
import { prefEnabled } from '@/lib/notifications/prefs';
import { formatCurrency } from '@/lib/utils/format';

/**
 * Weekly digest — proactive performance narrative per tenant.
 * Schedule weekly (e.g. Monday 08:00) with: Authorization: Bearer <CRON_SECRET>.
 * In-app notification is always created; email is best-effort (needs RESEND_*).
 */
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: tenants, error } = await admin
    .from('tenants')
    .select('id, name, slug, is_demo, currency')
    .eq('is_active', true);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  /** Money follows each tenant's own currency, not the server locale. */
  const fmtMoney = (n: number, currency: unknown) =>
    formatCurrency(Math.round(n), typeof currency === 'string' ? currency : undefined);
  let sent = 0;
  let skipped = 0;

  for (const t of tenants ?? []) {
    const tenantId = t.id as string;
    if ((t as { is_demo?: boolean }).is_demo) {
      skipped++;
      continue;
    }

    try {
      const digest = await buildTenantDigest(admin, tenantId, (t.name as string) ?? 'Marka');
      if (!digest.hasData) {
        skipped++;
        continue;
      }

      // In-app notification (works regardless of email config).
      await admin.from('notifications').insert({
        tenant_id: tenantId,
        user_id: null,
        sender_name: 'Mono AI',
        message: `Haftalık özet — ${digest.narrative}`,
        type: 'alert',
        is_read: false,
      });

      // Email to the client team (best-effort; no-op without RESEND_*).
      const { data: users } = await admin.from('users').select('email, notification_prefs').eq('tenant_id', tenantId);
      const emails = [
        ...new Set(
          (users ?? [])
            .filter((u) => prefEnabled(u.notification_prefs as Record<string, unknown> | null, 'emailWeeklyDigest'))
            .map((u) => (u.email as string)?.trim())
            .filter(Boolean),
        ),
      ];
      if (emails.length) {
        const { subject, html } = weeklyDigestEmail({
          tenantName: digest.tenantName,
          narrative: digest.narrative,
          actions: digest.actions,
          spend: fmtMoney(digest.current.spend, t.currency),
          revenue: fmtMoney(digest.current.revenue, t.currency),
          roas: (Math.round(digest.current.roas * 100) / 100).toLocaleString('tr-TR'),
          spendChangePct: digest.spendChangePct,
          revenueChangePct: digest.revenueChangePct,
          roasChangePct: digest.roasChangePct,
          dashboardUrl: getTenantDashboardUrl(t.slug as string, '/dashboard'),
        });
        await Promise.allSettled(emails.map((to) => sendEmail({ to, subject, html })));
      }

      sent++;
    } catch (e) {
      console.error('[cron/weekly-digest]', tenantId, e instanceof Error ? e.message : e);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, tenants: tenants?.length ?? 0, sent, skipped });
}
