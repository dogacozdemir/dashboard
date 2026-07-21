import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { SessionUser } from '@/types/user';

export const runtime = 'nodejs';

/** Store the browser's Web Push subscription for the current user. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const user = session.user as SessionUser;

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh;
  const authKey = body.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ ok: false, error: 'Missing subscription fields' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      tenant_id: user.tenantId,
      user_id: user.id,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('[push/subscribe]', error.message);
    return NextResponse.json({ ok: false, error: 'Could not store subscription' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
