import { getAdminStorageMetrics } from '@/features/admin/actions/adminStorageMetrics';
import { AdminUploadsClient } from '@/features/admin/components/AdminUploadsClient';

export default async function AdminUploadsPage() {
  const metrics = await getAdminStorageMetrics();
  return <AdminUploadsClient metrics={metrics} />;
}
