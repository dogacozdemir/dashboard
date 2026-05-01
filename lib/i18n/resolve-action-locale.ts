import { auth } from '@/lib/auth/config';
import type { SessionUser } from '@/types/user';
import type { AppLocale } from './constants';
import { resolveEffectiveLocale } from './resolve-effective-locale';

/** Locale for Server Actions (cookie ⊕ profile). */
export async function resolveActionLocale(): Promise<AppLocale> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  return resolveEffectiveLocale(user?.locale);
}
