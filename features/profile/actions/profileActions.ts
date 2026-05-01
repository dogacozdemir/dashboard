'use server';

import { getPremiumActionError } from '@/lib/copy/premium-copy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth/config';
import type { SessionUser } from '@/types/user';

export async function updateProfile(data: {
  fullName: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: 'Unauthorized' };

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

  return { success: true };
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: 'Unauthorized' };

  const user     = session.user as SessionUser;
  const supabase = await createSupabaseServerClient();

  // Verify current password via re-auth
  const { error: authError } = await supabase.auth.signInWithPassword({
    email:    user.email,
    password: currentPassword,
  });
  if (authError) return { success: false, error: 'Current password is incorrect' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: await getPremiumActionError() };

  return { success: true };
}

export async function fetchProfile() {
  const session = await auth();
  if (!session) return null;

  const user     = session.user as SessionUser;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, role, tenant_id, created_at')
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
