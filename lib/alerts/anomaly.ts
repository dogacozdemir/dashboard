import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/send';
import { anomalyAlertEmail } from '@/lib/email/templates';
import { getTenantDashboardUrl } from '@/lib/utils/tenant-urls';
import { prefEnabled } from '@/lib/notifications/prefs';
import { evaluateAnomalies } from './anomaly-rules';
import { sendPushToTenant } from '@/lib/push/send';

/**
 * Event-triggered anomaly alerts. Called after an ad sync: compares the last 3
 * days against a prior 14-day baseline and, when a key metric swings past a
 * threshold, raises an in-app notification + best-effort email. Throttled to at
 * most one alert per tenant per ~20h so it never spams.
 */

interface Window {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function windowTotals(admin: SupabaseClient, tenantId: string, from: string, to: string): Promise<Window> {
  const { data } = await admin.rpc('aggregate_daily_metrics_range', {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
  });
  const w: Window = { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 };
  for (const raw of (data as Array<Record<string, unknown>>) ?? []) {
    if (String(raw.platform) === 'organic') continue;
    w.spend += Number(raw.spend);
    w.revenue += Number(raw.revenue);
    w.impressions += Number(raw.impressions);
    w.clicks += Number(raw.clicks);
    w.conversions += Number(raw.conversions);
  }
  return w;
}

export async function detectAndNotifyAnomalies(
  admin: SupabaseClient,
  tenantId: string,
  tenantName: string,
  tenantSlug: string,
): Promise<{ fired: boolean; reason?: string }> {
  // Throttle: skip if an anomaly alert was already logged in the last ~20h.
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs } = await admin
    .from('technical_logs')
    .select('metadata')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .limit(50);
  if ((recentLogs ?? []).some((r) => (r.metadata as Record<string, unknown> | null)?.source === 'anomaly_alert')) {
    return { fired: false, reason: 'throttled' };
  }

  const now = new Date();
  const recTo = isoDate(now);
  const recFromD = new Date(now); recFromD.setDate(recFromD.getDate() - 2);
  const recFrom = isoDate(recFromD);
  const baseToD = new Date(recFromD); baseToD.setDate(baseToD.getDate() - 1);
  const baseTo = isoDate(baseToD);
  const baseFromD = new Date(baseToD); baseFromD.setDate(baseFromD.getDate() - 13);
  const baseFrom = isoDate(baseFromD);

  const [recent, baseline] = await Promise.all([
    windowTotals(admin, tenantId, recFrom, recTo),
    windowTotals(admin, tenantId, baseFrom, baseTo),
  ]);

  const verdict = evaluateAnomalies(recent, baseline);
  if (!verdict.fired) return { fired: false, reason: verdict.reason };
  const top = verdict.top;


  // In-app notification (always).
  await admin.from('notifications').insert({
    tenant_id: tenantId,
    user_id: null,
    sender_name: 'Mono AI',
    message: `${top.title} — ${top.body}`,
    type: 'alert',
    is_read: false,
  });

  // Throttle marker.
  await admin.from('technical_logs').insert({
    tenant_id: tenantId,
    type: 'system',
    description: `Anomaly alert: ${top.key}`,
    metadata: { source: 'anomaly_alert', key: top.key, severity: top.severity, at: new Date().toISOString() },
  });

  // Best-effort email (respecting per-user preference).
  try {
    const { data: users } = await admin.from('users').select('email, notification_prefs').eq('tenant_id', tenantId);
    const emails = [
      ...new Set(
        (users ?? [])
          .filter((u) => prefEnabled(u.notification_prefs as Record<string, unknown> | null, 'emailAnomaly'))
          .map((u) => (u.email as string)?.trim())
          .filter(Boolean),
      ),
    ];
    if (emails.length) {
      const { subject, html } = anomalyAlertEmail({
        tenantName,
        title: top.title,
        body: top.body,
        dashboardUrl: getTenantDashboardUrl(tenantSlug, '/performance'),
      });
      await Promise.allSettled(emails.map((to) => sendEmail({ to, subject, html })));
    }
  } catch (e) {
    console.error('[anomaly] email', e);
  }

  // Best-effort Web Push to subscribed devices (no-op without VAPID).
  try {
    await sendPushToTenant(admin, tenantId, { title: `⚠️ ${top.title}`, body: top.body, url: '/performance' });
  } catch (e) {
    console.error('[anomaly] push', e);
  }

  return { fired: true, reason: top.key };
}
