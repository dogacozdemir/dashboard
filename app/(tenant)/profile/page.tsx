import { redirect } from 'next/navigation';
import { fetchProfile } from '@/features/profile/actions/profileActions';
import { ProfileForm } from '@/features/profile/components/ProfileForm';
import { User } from 'lucide-react';

export default async function ProfilePage() {
  const profile = await fetchProfile();
  if (!profile) redirect('/login');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass glow-inset rounded-2xl p-5 border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
            <User className="w-5 h-5 text-white/50" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/80">Profile Settings</h2>
            <p className="text-xs text-white/40 mt-0.5">Manage your account and preferences</p>
          </div>
        </div>
      </div>

      <ProfileForm profile={profile} />
    </div>
  );
}
