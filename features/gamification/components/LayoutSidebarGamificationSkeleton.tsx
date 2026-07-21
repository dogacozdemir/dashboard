import { Sidebar } from '@/components/layout/Sidebar';
import type { Tenant } from '@/types/tenant';

export function LayoutSidebarGamificationSkeleton({
  tenant,
  canManageTeam,
}: {
  tenant: Tenant;
  canManageTeam: boolean;
}) {
  return <Sidebar tenant={tenant} gamification={null} canManageTeam={canManageTeam} />;
}
