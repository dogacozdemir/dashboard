import 'server-only';

import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Web Push (VAPID) delivery. Dormant without VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 * Stale subscriptions (404/410) are pruned automatically.
 */

let configured: boolean | null = null;
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@madmonos.com';
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Relative path opened on click (resolved against the tenant origin). */
  url?: string;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function deliver(admin: SupabaseClient, subs: SubRow[], payload: PushPayload): Promise<number> {
  if (!ensureConfigured() || subs.length === 0) return 0;
  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }),
  );
  return sent;
}

export async function sendPushToTenant(
  admin: SupabaseClient,
  tenantId: string,
  payload: PushPayload,
): Promise<{ sent: number }> {
  if (!ensureConfigured()) return { sent: 0 };
  const { data } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('tenant_id', tenantId);
  return { sent: await deliver(admin, (data as SubRow[]) ?? [], payload) };
}
