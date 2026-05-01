import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { IMPERSONATE_TENANT_COOKIE } from '@/lib/auth/constants';
import type { SessionUser } from '@/types/user';

const COOKIE_OPTS = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 8, // 8h
};

/**
 * Super-admin only: set or clear tenant impersonation (customer view).
 * POST JSON: { slug: string | null } — null/empty clears the cookie.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!session || user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { slug?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = body.slug;
  const slug = typeof raw === 'string' ? raw.trim() : '';

  const res = NextResponse.json({ ok: true, slug: slug || null });

  if (!slug) {
    res.cookies.delete(IMPERSONATE_TENANT_COOKIE);
    return res;
  }

  res.cookies.set(IMPERSONATE_TENANT_COOKIE, slug, COOKIE_OPTS);
  return res;
}
