'use server';

import { auth } from '@/lib/auth/config';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import type { SessionUser } from '@/types/user';
import { getPremiumActionError } from '@/lib/copy/premium-copy';

function canAccessNotifications(user: SessionUser | undefined): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return (
    sessionHasPermission(user, 'notifications.view') || sessionHasPermission(user, 'chat.send')
  );
}

export async function markNotificationRead(
  companyId: string,
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!canAccessNotifications(session?.user as SessionUser | undefined)) {
    return { success: false, error: 'Forbidden' };
  }
  const cid = await requireTenantAction(companyId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('tenant_id', cid);

  if (error) {
    console.error('[markNotificationRead]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }
  return { success: true };
}

export async function markAllNotificationsRead(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!canAccessNotifications(session?.user as SessionUser | undefined)) {
    return { success: false, error: 'Forbidden' };
  }
  const cid = await requireTenantAction(companyId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('tenant_id', cid)
    .eq('is_read', false);

  if (error) {
    console.error('[markAllNotificationsRead]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }
  return { success: true };
}
