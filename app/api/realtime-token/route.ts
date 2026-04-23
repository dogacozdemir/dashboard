import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { buildRealtimeToken } from '@/lib/auth/realtime-jwt';
import type { SessionUser } from '@/types/user';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.id || !user.tenantId) {
    return NextResponse.json({ error: 'Missing user tenant context' }, { status: 400 });
  }

  try {
    const token = buildRealtimeToken(user.id, user.tenantId, 60 * 10);
    return NextResponse.json({
      token,
      expiresIn: 600,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to issue realtime token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
