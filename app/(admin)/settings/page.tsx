import { fetchSystemSettings } from '@/features/admin/actions/adminSettingsActions';
import { AdminSettingsClient } from '@/features/admin/components/AdminSettingsClient';

export default async function AdminSettingsPage() {
  const settings = await fetchSystemSettings();
  return <AdminSettingsClient initialSettings={settings} />;
}
