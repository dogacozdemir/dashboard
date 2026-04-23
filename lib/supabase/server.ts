import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createSupabaseServerClient() {
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
          /**
           * In Server Components, Next.js forbids cookie mutation and throws:
           * "Cookies can only be modified in a Server Action or Route Handler".
           *
           * Supabase may still attempt to refresh/set cookies during read flows.
           * We ignore those write attempts here so RSC data fetching does not crash.
           */
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Safe no-op for RSC contexts where cookie writes are not allowed.
          }
        },
      },
    }
  );
}

export async function getTenantBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) return null;
  return data;
}
