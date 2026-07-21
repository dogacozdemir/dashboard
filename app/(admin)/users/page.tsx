import { AdminUsersClient } from '@/features/admin/components/AdminUsersClient';
import {
  fetchAdminUserFilterOptions,
  fetchAdminUsers,
} from '@/features/admin/actions/adminUserActions';

type PageProps = {
  searchParams: Promise<{ tenantId?: string; search?: string; roleId?: string; invite?: string }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() || undefined;
  const search = params.search?.trim() || undefined;
  const roleId = params.roleId?.trim() || undefined;
  const inviteOpen = params.invite === '1';

  const [users, filterOptions] = await Promise.all([
    fetchAdminUsers({ tenantId, search, roleId }),
    fetchAdminUserFilterOptions(),
  ]);

  return (
    <div className="cockpit-liquid-scope space-y-6">
      <AdminUsersClient
        initialUsers={users}
        tenants={filterOptions.tenants}
        filterRoles={filterOptions.roles}
        initialTenantId={tenantId ?? ''}
        initialSearch={search ?? ''}
        initialRoleId={roleId ?? ''}
        initialInviteOpen={inviteOpen}
      />
    </div>
  );
}
