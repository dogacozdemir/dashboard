'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Lock, Save, Loader2, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PasswordChangeForm } from '@/features/auth/components/PasswordChangeForm';
import { updateProfile } from '../actions/profileActions';

interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  tenant: { name: string; plan: string; logo_url: string | null } | null;
}

const PLAN_STYLE: Record<string, string> = {
  starter:    'text-white/50 bg-white/[0.06] border-white/10',
  growth:     'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  enterprise: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
};

function planLabelKey(plan: string): 'planStarter' | 'planGrowth' | 'planEnterprise' {
  if (plan === 'growth') return 'planGrowth';
  if (plan === 'enterprise') return 'planEnterprise';
  return 'planStarter';
}

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const t = useTranslations('Features.Profile');
  const router = useRouter();
  const [fullName,  setFullName]  = useState(profile.full_name ?? '');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [profilePending, startProfileTransition] = useTransition();

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : profile.email.slice(0, 2).toUpperCase();

  const plan       = profile.tenant?.plan ?? 'starter';
  const planColors = PLAN_STYLE[plan] ?? PLAN_STYLE.starter;
  const planText   = t(planLabelKey(plan));

  function saveProfile() {
    startProfileTransition(async () => {
      const result = await updateProfile({ fullName });
      setProfileMsg(result.success
        ? { ok: true,  text: t('toastProfileOk') }
        : { ok: false, text: result.error ?? t('toastProfileFail') }
      );
      // Re-render server components so TopBar/sidebar pick up the refreshed session name.
      if (result.success) router.refresh();
      setTimeout(() => setProfileMsg(null), 4000);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <GlassCard padding="lg" className="space-y-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-indigo-500/20 text-indigo-300 text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button type="button" className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-500/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300 hover:bg-indigo-500/50 transition-colors">
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <div>
            <p className="text-base font-semibold text-white/90">{profile.full_name ?? profile.email}</p>
            <p className="text-xs text-white/40 mt-0.5">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${planColors}`}>
                {planText}
              </span>
              <span className="text-[10px] text-white/30 capitalize">{profile.role}</span>
              {profile.tenant && (
                <>
                  <span className="text-[10px] text-white/20">·</span>
                  <span className="text-[10px] text-white/40">{profile.tenant.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-3.5 h-3.5 text-white/30" />
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{t('profileInfoHeading')}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/40">{t('fullName')}</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('fullNamePlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm placeholder-white/20 outline-none focus:border-indigo-500/40 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/40">{t('email')}</label>
            <input
              value={profile.email}
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 text-sm cursor-not-allowed"
            />
            <p className="text-[10px] text-white/20">{t('emailHint')}</p>
          </div>

          {profileMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${profileMsg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
            >
              {profileMsg.ok
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <AlertCircle className="w-3.5 h-3.5" />}
              {profileMsg.text}
            </motion.div>
          )}

          <button
            type="button"
            onClick={saveProfile}
            disabled={profilePending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-colors disabled:opacity-40"
          >
            {profilePending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {t('saveChanges')}
          </button>
        </div>
      </GlassCard>

      <GlassCard padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-white/30" />
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{t('changePasswordHeading')}</p>
        </div>

        <PasswordChangeForm sessionEmail={profile.email} className="space-y-3" />
      </GlassCard>
    </div>
  );
}
