import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchUserGamification } from '@/features/gamification/actions/fetchGamification';
import { MasteryExperience } from '@/features/gamification/components/MasteryExperience';
import { getLevel } from '@/features/gamification/lib/definitions';

export default async function MasteryPage() {
  await requireTenantContext();
  const gamification = await fetchUserGamification();
  const totalXP    = gamification?.totalXP ?? 0;
  const level      = gamification?.level ?? getLevel(0);
  const earnedKeys = gamification?.achievements.map((a) => a.key) ?? [];

  return (
    <div className="relative min-h-0 flex-1">
      <MasteryExperience totalXP={totalXP} level={level} earnedKeys={earnedKeys} />
    </div>
  );
}
