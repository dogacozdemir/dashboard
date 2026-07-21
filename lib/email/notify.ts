import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getTenantDashboardUrl } from '@/lib/utils/tenant-urls';
import { sendEmail } from './send';
import { creativeReviewEmail, agencyCreativeEventEmail } from './templates';
import { prefEnabled } from '@/lib/notifications/prefs';

function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/**
 * Best-effort: notify the Madmonos agency inbox when a client requests a revision
 * or approves a creative. No-op without RESEND_* + AGENCY_NOTIFY_EMAIL.
 */
export async function notifyAgencyCreativeEvent(input: {
  tenantId: string;
  postTitle: string;
  kind: 'revision' | 'approved';
  byName?: string;
}): Promise<void> {
  const agencyInbox = process.env.AGENCY_NOTIFY_EMAIL?.trim();
  if (!emailConfigured() || !agencyInbox) return;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return;
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('slug, name')
    .eq('id', input.tenantId)
    .maybeSingle();
  if (!tenant?.slug) return;

  const reviewUrl = getTenantDashboardUrl(tenant.slug as string, '/creative');
  const { subject, html } = agencyCreativeEventEmail({
    tenantName: (tenant.name as string) ?? 'Marka',
    postTitle: input.postTitle,
    kind: input.kind,
    byName: input.byName,
    reviewUrl,
  });

  await sendEmail({ to: agencyInbox, subject, html });
}

/**
 * Best-effort: email the client's workspace members that a new creative is
 * awaiting review. Silent no-op when email isn't configured. Sends one message
 * per recipient so addresses aren't exposed to each other.
 */
export async function notifyCreativePendingReview(input: {
  tenantId: string;
  postTitle: string;
}): Promise<void> {
  if (!emailConfigured()) return;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return;
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('slug, name')
    .eq('id', input.tenantId)
    .maybeSingle();
  if (!tenant?.slug) return;

  const { data: users } = await admin
    .from('users')
    .select('email, notification_prefs')
    .eq('tenant_id', input.tenantId);

  const emails = [
    ...new Set(
      (users ?? [])
        .filter((u) => prefEnabled(u.notification_prefs as Record<string, unknown> | null, 'emailCreativeReview'))
        .map((u) => (u.email as string)?.trim())
        .filter(Boolean),
    ),
  ];
  if (emails.length === 0) return;

  const reviewUrl = getTenantDashboardUrl(tenant.slug as string, '/creative');
  const { subject, html } = creativeReviewEmail({
    postTitle: input.postTitle,
    tenantName: (tenant.name as string) ?? 'Madmonos',
    reviewUrl,
  });

  await Promise.allSettled(emails.map((to) => sendEmail({ to, subject, html })));
}
