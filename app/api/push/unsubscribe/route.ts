import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { SessionUser } from '@/types/user';

export const runtime = 'nodejs';

/** Remove a Web Push subscription for the current user. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const user = session.user as SessionUser;

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
  const endpoint = body.endpoint?.trim();
  if (!endpoint) return NextResponse.json({ ok: false, error: 'Missing endpoint' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
