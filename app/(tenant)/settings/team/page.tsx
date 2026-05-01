import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { listAssignableRolesForTenant, listTeamMembers } from '@/features/team/actions/teamActions';
import { TeamSettingsView } from './TeamSettingsView';
import type { SessionUser } from '@/types/user';

export default async function TeamSettingsPage() {
  const { companyId } = await requireTenantContext();
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  if (!sessionHasPermission(user, 'management.users')) {
    redirect('/unauthorized');
  }

  const [members, assignableRoles] = await Promise.all([
    listTeamMembers(companyId),
    listAssignableRolesForTenant(companyId),
  ]);

  return (
    <TeamSettingsView
      companyId={companyId}
      currentUserId={user!.id}
      initialMembers={members}
      assignableRoles={assignableRoles}
    />
  );
}
