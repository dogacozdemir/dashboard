'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { PasswordChangeForm } from '@/features/auth/components/PasswordChangeForm';
import { validateLoginTenant } from '@/features/auth/actions/validateLoginTenant';
import { isScopedTenantHostSlug } from '@/lib/utils/parse-tenant-host';
import { cn } from '@/lib/utils/cn';

type AuthMode = 'signIn' | 'changePassword';

function normalizeCallbackUrl(raw: string | null): string {
  if (!raw?.trim()) return '/dashboard';
  const trimmed = raw.trim();
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.pathname + url.search;
  } catch {
    return '/dashboard';
  }
}

function mapAuthErrorParam(code: string | null): string | null {
  if (!code) return null;
  if (code === 'CredentialsSignin') return 'invalidCredentials';
  return 'invalidCredentials';
}

export function LoginForm({ hostTenantSlug }: { hostTenantSlug: string }) {
  const searchParams = useSearchParams();
  const t = useTranslations('Auth');
  const callbackUrl = normalizeCallbackUrl(searchParams.get('callbackUrl'));

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const key = mapAuthErrorParam(searchParams.get('error'));
    if (key) setError(t(key));
  }, [searchParams, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isScopedTenantHostSlug(hostTenantSlug)) {
        const tenantCheck = await validateLoginTenant(email, hostTenantSlug);
        if (!tenantCheck.ok) {
          setError(t('tenantAccessDenied'));
          return;
        }
      }

      const result = await signIn('credentials', {
        email,
        password,
        hostTenantSlug,
        redirect: false,
      });

      if (!result || result.error || result.ok === false) {
        setError(t('invalidCredentials'));
        return;
      }

      const session = await getSession();
      if (!session?.user) {
        setError(t('sessionNotPersisted'));
        return;
      }

      window.location.assign(callbackUrl);
    } catch {
      setError(t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlassCard padding="lg" className="space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9c70b2] to-[#bea042] mb-4 shadow-lg shadow-[#9c70b2]/20">
            <Image
              src="/madmonos-logo-optimized.png"
              alt="Madmonos logo"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-bold gradient-text-indigo">{t('brandTitle')}</h1>
          <p className="text-xs text-white/30 uppercase tracking-widest">{t('tagline')}</p>
          <p className="text-sm text-white/50 pt-2">
            {mode === 'signIn' ? t('signInSubtitle') : t('passwordChange.subtitle')}
          </p>
        </div>

        <div className="flex rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
          {(['signIn', 'changePassword'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setError('');
              }}
              className={cn(
                'flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
                mode === key
                  ? 'bg-white/[0.10] text-white/90 shadow-sm'
                  : 'text-white/40 hover:text-white/60',
              )}
            >
              {key === 'signIn' ? t('tabSignIn') : t('tabChangePassword')}
            </button>
          ))}
        </div>

        {mode === 'signIn' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/90 placeholder-white/20 text-sm outline-none focus:border-[#9c70b2]/50 focus:bg-white/[0.07] transition-all"
                placeholder={t('placeholderEmail')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                {t('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/90 placeholder-white/20 text-sm outline-none focus:border-[#9c70b2]/50 focus:bg-white/[0.07] transition-all"
                placeholder={t('placeholderPassword')}
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#9c70b2] to-[#bea042] hover:from-[#b48dc8] hover:to-[#d4b44c] text-white text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#9c70b2]/25"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('submit')}
            </button>
          </form>
        ) : (
          <PasswordChangeForm showEmail />
        )}

        <p className="text-center text-xs text-white/20">{t('footer')}</p>
      </GlassCard>
    </motion.div>
  );
}
