import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  IMPERSONATE_TENANT_COOKIE,
  IMPERSONATE_TENANT_ID_COOKIE,
} from '@/lib/auth/constants';
import { getSharedCookieDomain } from '@/lib/auth/cookie-domain';
import { resolveTenantIdBySlug } from '@/lib/auth/resolve-tenant-id';
import type { SessionUser } from '@/types/user';
import {
  premiumForbiddenMessage,
  premiumSessionRequiredMessage,
} from '@/lib/i18n/premium-action-errors';
import { getTranslations } from 'next-intl/server';
import { resolveActionLocale } from '@/lib/i18n/resolve-action-locale';

function cookieBaseOpts() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    domain: getSharedCookieDomain(),
  };
}

function clearImpersonationCookies(res: NextResponse) {
  const base = cookieBaseOpts();
  for (const name of [IMPERSONATE_TENANT_COOKIE, IMPERSONATE_TENANT_ID_COOKIE]) {
    res.cookies.set(name, '', { ...base, maxAge: 0 });
    res.cookies.delete(name);
  }
}

/**
 * Super-admin only: set or clear tenant impersonation (customer view).
 * POST JSON: { slug: string | null } — null/empty clears the cookie.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!session) {
    return NextResponse.json({ error: await premiumSessionRequiredMessage() }, { status: 401 });
  }
  if (user?.role !== 'super_admin') {
    return NextResponse.json({ error: await premiumForbiddenMessage() }, { status: 403 });
  }

  let body: { slug?: string | null };
  try {
    body = await request.json();
  } catch {
    const locale = await resolveActionLocale();
    const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
    return NextResponse.json({ error: t('invalidPayload') }, { status: 400 });
  }

  const raw = body.slug;
  const slug = typeof raw === 'string' ? raw.trim().toLowerCase() : '';

  const res = NextResponse.json({ ok: true, slug: slug || null });

  if (!slug) {
    clearImpersonationCookies(res);
    return res;
  }

  const tenantId = await resolveTenantIdBySlug(slug);
  if (!tenantId) {
    const locale = await resolveActionLocale();
    const t = await getTranslations({ locale, namespace: 'PremiumMessages' });
    return NextResponse.json({ error: t('invalidPayload') }, { status: 404 });
  }

  const base = cookieBaseOpts();
  res.cookies.set(IMPERSONATE_TENANT_COOKIE, slug, { ...base, maxAge: 60 * 60 * 8 });
  res.cookies.set(IMPERSONATE_TENANT_ID_COOKIE, tenantId, { ...base, maxAge: 60 * 60 * 8 });
  return res;
}
