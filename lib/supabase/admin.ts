import { createClient } from '@supabase/supabase-js';

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
  return createClient(url, key);
}
