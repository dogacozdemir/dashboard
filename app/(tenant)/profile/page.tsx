import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { fetchProfile } from '@/features/profile/actions/profileActions';
import { ProfileForm } from '@/features/profile/components/ProfileForm';
import { ProfileSettingsShell } from './ProfileSettingsShell';
import { RestartTourButton } from '@/features/onboarding/components/MagicTour';
import { User, Compass } from 'lucide-react';

export default async function ProfilePage() {
  const profile = await fetchProfile();
  if (!profile) redirect('/login');

  const t = await getTranslations('Pages.profile');

  return (
    <ProfileSettingsShell>
      <div className="space-y-6">
        <div className="glass glow-inset rounded-2xl p-5 border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
              <User className="w-5 h-5 text-white/50" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/80">{t('settingsTitle')}</h2>
              <p className="text-xs text-white/40 mt-0.5">{t('settingsSubtitle')}</p>
            </div>
          </div>
        </div>

        <ProfileForm profile={profile} />

        {/* Product tour */}
        <div className="glass rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#bea042]/10 border border-[#bea042]/20 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4 text-[#bea042]/80" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/75">{t('tourHeading')}</p>
                <p className="text-xs text-white/35 mt-0.5">{t('tourSubtitle')}</p>
              </div>
            </div>
            <RestartTourButton />
          </div>
        </div>
      </div>
    </ProfileSettingsShell>
  );
}
