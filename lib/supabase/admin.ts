import { createClient } from '@supabase/supabase-js';

function assertServiceRoleKey(key: string): void {
  try {
    const segment = key.split('.')[1];
    if (!segment) return;
    const payload = JSON.parse(Buffer.from(segment, 'base64url').toString()) as {
      role?: string;
    };
    if (payload.role && payload.role !== 'service_role') {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY has JWT role "${payload.role}" — expected "service_role". ` +
          'Copy the secret service_role key from Supabase Dashboard → Project Settings → API (not the anon/publishable key).',
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('expected "service_role"')) throw e;
    // Non-JWT keys (legacy) — skip validation
  }
}

/**
 * Service-role client for cron / internal jobs (bypasses RLS).
 * Requires SUPABASE_SERVICE_ROLE_KEY — never expose to the browser.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin client');
  }
  assertServiceRoleKey(key);
  return createClient(url, key);
}
