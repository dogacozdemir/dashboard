'use server';

import { getPremiumActionError } from '@/lib/copy/premium-copy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth/config';
import type { SessionUser } from '@/types/user';

export type PasswordChangeErrorKey =
  | 'sessionRequired'
  | 'wrongCurrentPassword'
  | 'weakPassword';

export async function changePasswordAction(data: {
  currentPassword: string;
  newPassword: string;
  email?: string;
}): Promise<{ success: boolean; error?: string; errorKey?: PasswordChangeErrorKey }> {
  const session = await auth();
  const sessionEmail = session ? (session.user as SessionUser).email : undefined;
  // Session email ALWAYS wins: a logged-in user may only change their own password.
  // The client-supplied email is honored solely for the unauthenticated login-page flow.
  const email = (sessionEmail ?? data.email?.trim().toLowerCase())?.trim();

  if (!email) {
    return { success: false, errorKey: 'sessionRequired' };
  }

  if (data.newPassword.length < 8) {
    return { success: false, errorKey: 'weakPassword' };
  }

  const supabase = await createSupabaseServerClient();

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: data.currentPassword,
  });
  if (authError) {
    return { success: false, errorKey: 'wrongCurrentPassword' };
  }

  const { error } = await supabase.auth.updateUser({ password: data.newPassword });
  if (error) {
    console.error('[changePasswordAction]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }

  return { success: true };
}
