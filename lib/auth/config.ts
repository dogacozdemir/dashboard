import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SessionUser } from '@/types/user';

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
        token.id = u.id;
        token.role = u.role;
        token.tenantId = u.tenantId;
        token.tenantSlug = u.tenantSlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as unknown as SessionUser).role = token.role as SessionUser['role'];
        (session.user as unknown as SessionUser).tenantId = token.tenantId as string;
        (session.user as unknown as SessionUser).tenantSlug = token.tenantSlug as string;
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
          .select('id, email, full_name, avatar_url, role, tenant_id')
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

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          image: profile.avatar_url,
          role: profile.role,
          tenantId: profile.tenant_id,
          tenantSlug: tenant.slug ?? '',
        };
      },
    }),
  ],
});
