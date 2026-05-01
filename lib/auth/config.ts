import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchCapabilitiesForUser } from '@/lib/auth/capabilities';
import type { SessionUser, UserLocale } from '@/types/user';

function normalizeUserLocale(raw: unknown): UserLocale {
  return raw === 'en' ? 'en' : 'tr';
}

const CAPABILITIES_JWT_SYNC_MS = 5 * 60_000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        token.sub = u.id as string;
        token.id = u.id;
        token.role = u.role;
        token.tenantId = u.tenantId;
        token.tenantSlug = u.tenantSlug;
        token.locale = normalizeUserLocale(u.locale);
        token.capabilities = (u.capabilities ?? []) as SessionUser['capabilities'];
        token.permsSyncedAt = Date.now();
        return token;
      }

      const uid = (token.sub ?? token.id) as string | undefined;
      if (uid && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const now = Date.now();
        const last =
          typeof token.permsSyncedAt === 'number' ? token.permsSyncedAt : 0;
        if (now - last >= CAPABILITIES_JWT_SYNC_MS) {
          try {
            const admin = createSupabaseAdminClient();
            const { data: profile } = await admin
              .from('users')
              .select('role, role_id, tenant_id, locale')
              .eq('id', uid)
              .maybeSingle();

            if (profile?.role_id && profile.tenant_id) {
              token.role = profile.role as SessionUser['role'];
              token.tenantId = profile.tenant_id as string;
              token.locale = normalizeUserLocale(
                (profile as { locale?: string | null }).locale
              );
              token.capabilities = await fetchCapabilitiesForUser(
                admin,
                profile.role_id as string,
                profile.tenant_id as string
              );
              const { data: tenant } = await admin
                .from('tenants')
                .select('slug')
                .eq('id', profile.tenant_id as string)
                .maybeSingle();
              if (tenant?.slug) token.tenantSlug = tenant.slug as string;
              token.permsSyncedAt = now;
            }
          } catch (e) {
            console.error('[auth/jwt] permission sync failed', e);
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as unknown as SessionUser).role = token.role as SessionUser['role'];
        (session.user as unknown as SessionUser).tenantId = token.tenantId as string;
        (session.user as unknown as SessionUser).tenantSlug = token.tenantSlug as string;
        (session.user as unknown as SessionUser).locale = normalizeUserLocale(token.locale);
        (session.user as unknown as SessionUser).capabilities =
          (token.capabilities as SessionUser['capabilities']) ?? [];
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const supabase = await createSupabaseServerClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email as string,
          password: credentials.password as string,
        });

        if (error || !data.user) {
          // For QA debugging: this will show up in the dev server console
          console.error('[NextAuth][credentials] signInWithPassword failed:', error?.message);
          return null;
        }

        // Defense + reliability: avoid `select('*')` and avoid relying on join naming.
        // We fetch the tenant slug with a second query.
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, email, full_name, avatar_url, role, role_id, tenant_id, locale')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          console.error('[NextAuth][credentials] profile fetch failed:', profileError?.message);
          return null;
        }

        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('id, slug')
          .eq('id', profile.tenant_id)
          .single();

        if (tenantError || !tenant) {
          console.error('[NextAuth][credentials] tenant fetch failed:', tenantError?.message);
          return null;
        }

        let roleId = (profile as { role_id?: string }).role_id;
        if (!roleId && profile.role) {
          const { data: r } = await supabase
            .from('roles')
            .select('id')
            .eq('slug', profile.role)
            .is('tenant_id', null)
            .maybeSingle();
          roleId = r?.id;
        }
        if (!roleId) {
          console.error('[NextAuth][credentials] missing role_id');
          return null;
        }

        const capabilities = await fetchCapabilitiesForUser(
          supabase,
          roleId,
          profile.tenant_id as string
        );

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          image: profile.avatar_url,
          role: profile.role,
          tenantId: profile.tenant_id,
          tenantSlug: tenant.slug ?? '',
          locale: normalizeUserLocale((profile as { locale?: string | null }).locale),
          capabilities,
        };
      },
    }),
  ],
});
