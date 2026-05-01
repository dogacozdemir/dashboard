import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client (bypasses RLS). Use only in trusted server contexts
 * after verifying tenant ownership (e.g. background indexing after upload).
 */
export function createServiceSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
