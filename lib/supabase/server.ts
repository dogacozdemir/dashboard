import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { seedTenantIdCache } from '@/lib/auth/tenant-cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createSupabaseServerClientImpl() {
  const cookieStore = await cookies();

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Safe no-op for RSC contexts where cookie writes are not allowed.
          }
        },
      },
    },
  );
}

/** Request-scoped Supabase client — one instance per render pass. */
export const createSupabaseServerClient = cache(createSupabaseServerClientImpl);

async function fetchTenantBySlugImpl(slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || normalized === 'localhost' || normalized === 'admin' || normalized === 'www') {
    return null;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('tenants')
      .select('*')
      .eq('slug', normalized)
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data) {
      seedTenantIdCache(normalized, data.id as string);
      return data;
    }
  } catch {
    /* fall back to session-scoped client */
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', normalized)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  seedTenantIdCache(normalized, data.id as string);
  return data;
}

/** Request-scoped tenant row — one DB hit per slug per render pass. */
export const getTenantBySlug = cache(fetchTenantBySlugImpl);
