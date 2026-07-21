import { CommandCenter } from '@/app/components/layout/CommandCenter';
import { fetchUserGamificationCached } from '@/features/gamification/data/fetchUserGamificationCached';
import type { SessionUser } from '@/types/user';

interface LayoutCommandCenterGamificationProps {
  companyId: string;
  user: SessionUser;
}

export async function LayoutCommandCenterGamification({
  companyId,
  user,
}: LayoutCommandCenterGamificationProps) {
  const gamification = await fetchUserGamificationCached();
  return (
    <CommandCenter
      companyId={companyId}
      user={user}
      totalXP={gamification?.totalXP ?? null}
      level={gamification?.level.level ?? null}
    />
  );
}
