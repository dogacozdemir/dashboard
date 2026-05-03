'use server';

import { cookies } from 'next/headers';
import { auth } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SessionUser } from '@/types/user';
import {
  LOCALE_COOKIE,
  type AppLocale,
  normalizeLocale,
} from '@/lib/i18n/constants';

export async function updateUserLocaleAction(
  locale: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    const { premiumSessionRequiredMessage } = await import('@/lib/i18n/premium-action-errors');
    return { ok: false, error: await premiumSessionRequiredMessage() };
  }

  const user = session.user as SessionUser;
  const next: AppLocale = normalizeLocale(locale);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('users')
    .update({ locale: next })
    .eq('id', user.id);

  if (error) {
    console.error('[updateUserLocale]', error.message);
    return { ok: false, error: 'Failed' };
  }

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  });

  return { ok: true };
}
