import { Sidebar } from '@/components/layout/Sidebar';
import { fetchUserGamificationCached } from '@/features/gamification/data/fetchUserGamificationCached';
import type { Tenant } from '@/types/tenant';

interface LayoutSidebarGamificationProps {
  tenant: Tenant;
  canManageTeam: boolean;
}

export async function LayoutSidebarGamification({
  tenant,
  canManageTeam,
}: LayoutSidebarGamificationProps) {
  const gamification = await fetchUserGamificationCached();
  return <Sidebar tenant={tenant} gamification={gamification} canManageTeam={canManageTeam} />;
}
