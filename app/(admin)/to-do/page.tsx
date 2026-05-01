import { fetchAdminOverview } from '@/features/admin/actions/fetchAdmin';
import { fetchAdminTasks } from '@/features/admin/actions/fetchAdminTasks';
import { AdminOpsCenterClient } from '@/features/admin/components/AdminOpsCenterClient';

export default async function AdminOpsToDoPage() {
  const [ops, health] = await Promise.all([fetchAdminTasks(), fetchAdminOverview()]);
  return <AdminOpsCenterClient activeTasks={ops.activeTasks} recentApprovals={ops.recentApprovals} health={health} />;
}
