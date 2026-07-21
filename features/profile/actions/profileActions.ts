'use server';

import { getPremiumActionError } from '@/lib/copy/premium-copy';
import { premiumSessionRequiredMessage } from '@/lib/i18n/premium-action-errors';
import { changePasswordAction } from '@/lib/auth/password-actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { auth, unstable_update } from '@/lib/auth/config';
import type { SessionUser } from '@/types/user';

export async function updateProfile(data: {
  fullName: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: await premiumSessionRequiredMessage() };

  const user     = session.user as SessionUser;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('users')
    .update({
      full_name:  data.fullName.trim() || null,
      avatar_url: data.avatarUrl ?? null,
    })
    .eq('id', user.id);

  if (error) {
    console.error('[updateProfile]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }

  // Refresh the JWT display fields so the shell (TopBar/sidebar) shows the new
  // name/avatar without a re-login. Best-effort — the DB write is authoritative.
  try {
    await unstable_update({
      name: data.fullName.trim() || null,
      image: data.avatarUrl ?? null,
    } as never);
  } catch (e) {
    console.error('[updateProfile] session refresh skipped', e);
  }

  return { success: true };
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; errorKey?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: await premiumSessionRequiredMessage() };

  return changePasswordAction({ currentPassword, newPassword });
}

export async function updateNotificationPrefs(
  patch: Record<string, boolean>,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: await premiumSessionRequiredMessage() };

  const user = session.user as SessionUser;
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from('users')
    .select('notification_prefs')
    .eq('id', user.id)
    .maybeSingle();

  const current = (row?.notification_prefs as Record<string, unknown> | null) ?? {};
  const next = { ...current, ...patch };

  const { error } = await supabase
    .from('users')
    .update({ notification_prefs: next })
    .eq('id', user.id);

  if (error) {
    console.error('[updateNotificationPrefs]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }
  return { success: true };
}

export async function fetchProfile() {
  const session = await auth();
  if (!session) return null;

  const user     = session.user as SessionUser;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, role, tenant_id, created_at, notification_prefs')
    .eq('id', user.id)
    .single();

  if (!data) return null;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, plan, logo_url')
    .eq('id', data.tenant_id)
    .single();

  return { ...data, tenant };
}
