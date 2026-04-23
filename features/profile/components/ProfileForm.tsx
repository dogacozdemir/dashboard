'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Save, Loader2, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateProfile, updatePassword } from '../actions/profileActions';

interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  tenant: { name: string; plan: string; logo_url: string | null } | null;
}

const PLAN_CONFIG = {
  starter:    { label: 'Starter',    color: 'text-white/50 bg-white/[0.06] border-white/10' },
  growth:     { label: 'Growth',     color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  enterprise: { label: 'Enterprise', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
};

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const [fullName,  setFullName]  = useState(profile.full_name ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg,      setPwMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  const [profilePending, startProfileTransition] = useTransition();
  const [pwPending,      startPwTransition]      = useTransition();

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : profile.email.slice(0, 2).toUpperCase();

  const plan    = (profile.tenant?.plan ?? 'starter') as keyof typeof PLAN_CONFIG;
  const planCfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.starter;

  function saveProfile() {
    startProfileTransition(async () => {
      const result = await updateProfile({ fullName });
      setProfileMsg(result.success
        ? { ok: true,  text: 'Profile updated successfully' }
        : { ok: false, text: result.error ?? 'Update failed' }
      );
      setTimeout(() => setProfileMsg(null), 4000);
    });
  }

  function savePassword() {
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: 'New passwords do not match' });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: 'Password must be at least 8 characters' });
      return;
    }
    startPwTransition(async () => {
      const result = await updatePassword(currentPw, newPw);
      setPwMsg(result.success
        ? { ok: true,  text: 'Password changed successfully' }
        : { ok: false, text: result.error ?? 'Update failed' }
      );
      if (result.success) { setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
      setTimeout(() => setPwMsg(null), 4000);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Identity card */}
      <GlassCard padding="lg" className="space-y-6">
        {/* Avatar + plan */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-indigo-500/20 text-indigo-300 text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-500/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300 hover:bg-indigo-500/50 transition-colors">
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <div>
            <p className="text-base font-semibold text-white/90">{profile.full_name ?? profile.email}</p>
            <p className="text-xs text-white/40 mt-0.5">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${planCfg.color}`}>
                {planCfg.label}
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

        {/* Fields */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-3.5 h-3.5 text-white/30" />
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Profile Info</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/40">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm placeholder-white/20 outline-none focus:border-indigo-500/40 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/40">Email</label>
            <input
              value={profile.email}
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 text-sm cursor-not-allowed"
            />
            <p className="text-[10px] text-white/20">Email cannot be changed here</p>
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
            onClick={saveProfile}
            disabled={profilePending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-colors disabled:opacity-40"
          >
            {profilePending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </GlassCard>

      {/* Password card */}
      <GlassCard padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-white/30" />
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Change Password</p>
        </div>

        {(['Current Password', 'New Password', 'Confirm New Password'] as const).map((label, i) => {
          const vals  = [currentPw, newPw, confirmPw];
          const setters = [setCurrentPw, setNewPw, setConfirmPw];
          return (
            <div key={label} className="space-y-1">
              <label className="text-xs text-white/40">{label}</label>
              <input
                type="password"
                value={vals[i]}
                onChange={(e) => setters[i](e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/90 text-sm placeholder-white/20 outline-none focus:border-indigo-500/40 transition-all"
              />
            </div>
          );
        })}

        {pwMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${pwMsg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
          >
            {pwMsg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {pwMsg.text}
          </motion.div>
        )}

        <button
          onClick={savePassword}
          disabled={pwPending || !currentPw || !newPw || !confirmPw}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/[0.09] transition-colors disabled:opacity-40"
        >
          {pwPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
          Update Password
        </button>
      </GlassCard>
    </div>
  );
}
