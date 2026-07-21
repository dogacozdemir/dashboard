'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { changePasswordAction, type PasswordChangeErrorKey } from '@/lib/auth/password-actions';

type Props = {
  /** When set, email field is hidden and omitted from the action (session email is used). */
  sessionEmail?: string;
  /** Show email input (login page). */
  showEmail?: boolean;
  className?: string;
};

function resolvePasswordError(
  t: ReturnType<typeof useTranslations>,
  errorKey?: PasswordChangeErrorKey,
  error?: string,
) {
  if (errorKey === 'wrongCurrentPassword') return t('wrongCurrentPassword');
  if (errorKey === 'weakPassword') return t('toastPwShort');
  if (errorKey === 'sessionRequired') return t('sessionRequired');
  return error ?? t('toastPwFail');
}

export function PasswordChangeForm({ sessionEmail, showEmail = false, className }: Props) {
  const t = useTranslations('Auth.passwordChange');
  const [email, setEmail] = useState(sessionEmail ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPw !== confirmPw) {
      setMsg({ ok: false, text: t('toastPwMismatch') });
      return;
    }
    if (newPw.length < 8) {
      setMsg({ ok: false, text: t('toastPwShort') });
      return;
    }

    startTransition(async () => {
      const result = await changePasswordAction({
        email: showEmail ? email : undefined,
        currentPassword: currentPw,
        newPassword: newPw,
      });

      setMsg(
        result.success
          ? { ok: true, text: t('toastPwOk') }
          : { ok: false, text: resolvePasswordError(t, result.errorKey, result.error) },
      );

      if (result.success) {
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      }
      window.setTimeout(() => setMsg(null), 4500);
    });
  }

  const fields = [
    { key: 'currentPassword' as const, value: currentPw, onChange: setCurrentPw },
    { key: 'newPassword' as const, value: newPw, onChange: setNewPw },
    { key: 'confirmPassword' as const, value: confirmPw, onChange: setConfirmPw },
  ];

  return (
    <form onSubmit={onSubmit} className={className ?? 'space-y-4'}>
      {showEmail && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            {t('email')}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('placeholderEmail')}
            className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/90 placeholder-white/20 text-sm outline-none focus:border-[#9c70b2]/50 focus:bg-white/[0.07] transition-all"
          />
        </div>
      )}

      {fields.map(({ key, value, onChange }) => (
        <div key={key} className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            {t(key)}
          </label>
          <input
            type="password"
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('placeholderPassword')}
            className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/90 placeholder-white/20 text-sm outline-none focus:border-[#9c70b2]/50 focus:bg-white/[0.07] transition-all"
          />
        </div>
      ))}

      {msg && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            msg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {msg.text}
        </motion.div>
      )}

      <button
        type="submit"
        disabled={pending || !currentPw || !newPw || !confirmPw || (showEmail && !email)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.12] text-white/80 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        {t('submit')}
      </button>
    </form>
  );
}
