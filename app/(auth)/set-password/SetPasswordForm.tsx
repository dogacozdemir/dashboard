'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Phase = 'checking' | 'ready' | 'invalid';

/** Supabase OTP types that can carry an invite/recovery token_hash. */
type OtpType = 'invite' | 'recovery' | 'signup' | 'email' | 'magiclink' | 'email_change';

export function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('Auth');

  const [phase, setPhase] = useState<Phase>('checking');
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Establish a Supabase session from the invite/recovery link (multiple flows supported).
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function establish() {
      const tokenHash = searchParams.get('token_hash');
      const type = (searchParams.get('type') as OtpType | null) ?? 'invite';
      const code = searchParams.get('code');

      try {
        if (tokenHash) {
          await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
        // Implicit (hash) links are auto-detected by the browser client on load.
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        if (data.user?.email) {
          setEmail(data.user.email);
          setPhase('ready');
        } else {
          setPhase('invalid');
        }
      } catch {
        if (!cancelled) setPhase('invalid');
      }
    }

    void establish();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(t('pwMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('pwTooShort'));
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(t('setPasswordError'));
      setLoading(false);
      return;
    }

    if (!email) {
      // Password set, but we can't auto sign-in without the email — send to login.
      router.push('/login');
      return;
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      // Password was set; let them sign in manually.
      router.push('/login');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
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
          <h1 className="text-xl font-bold gradient-text-indigo">{t('setPasswordTitle')}</h1>
          <p className="text-sm text-white/50 pt-1">{t('setPasswordSubtitle')}</p>
        </div>

        {phase === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-6 text-white/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-sm">{t('checkingLink')}</p>
          </div>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-white/70">{t('invalidLinkTitle')}</p>
            <p className="text-xs text-white/40">{t('invalidLinkHint')}</p>
            <Link
              href="/login"
              className="inline-block text-sm font-semibold text-[#bea042] hover:text-[#d4b44c] transition-colors"
            >
              {t('backToLogin')}
            </Link>
          </div>
        )}

        {phase === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {email && (
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5">
                <ShieldCheck className="w-4 h-4 text-[#bea042]/80 shrink-0" />
                <span className="text-sm text-white/70 truncate">{email}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{t('newPassword')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/90 placeholder-white/20 text-sm outline-none focus:border-[#9c70b2]/50 focus:bg-white/[0.07] transition-all"
                placeholder={t('placeholderPassword')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{t('confirmPassword')}</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('submitSetPassword')}
            </button>
          </form>
        )}
      </GlassCard>
    </motion.div>
  );
}
