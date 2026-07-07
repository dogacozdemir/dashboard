import { fetchAdminChatTenants } from '@/features/admin/actions/adminChatActions';
import { AdminChatHubClient } from '@/features/admin/components/AdminChatHubClient';

export default async function AdminSupportHubPage() {
  const tenants = await fetchAdminChatTenants();
  return <AdminChatHubClient initialTenants={tenants} />;
}
