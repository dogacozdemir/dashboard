import { fetchAdminOverview } from '@/features/admin/actions/fetchAdmin';
import { AdminControlCenterClient } from '@/features/admin/components/AdminControlCenterClient';

export default async function AdminHomePage() {
  const stats = await fetchAdminOverview();
  return <AdminControlCenterClient stats={stats} />;
}
