'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('Auth');
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(t('invalidCredentials'));
      setLoading(false);
    } else {
      router.push(callbackUrl);
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
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold gradient-text-indigo">{t('brandTitle')}</h1>
          <p className="text-xs text-white/30 uppercase tracking-widest">{t('tagline')}</p>
          <p className="text-sm text-white/50 pt-2">{t('signInSubtitle')}</p>
        </div>

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
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t('submit')
            )}
          </button>
        </form>

        <p className="text-center text-xs text-white/20">
          {t('footer')}
        </p>
      </GlassCard>
    </motion.div>
  );
}
