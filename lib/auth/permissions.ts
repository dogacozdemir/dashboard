import { auth } from '@/lib/auth/config';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import type { PermissionSlug, SessionUser } from '@/types/user';

export async function requirePermission(slug: PermissionSlug): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized: not authenticated');

  const user = session.user as SessionUser;
  if (!sessionHasPermission(user, slug)) {
    throw new Error(`Forbidden: missing permission ${slug}`);
  }
}

/** Alias for clarity in call sites (assert vs require). */
export const assertPermission = requirePermission;

export { sessionHasPermission };
