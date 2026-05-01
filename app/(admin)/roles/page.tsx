import { getTranslations } from 'next-intl/server';
import { requireAdminSession } from '@/lib/auth/tenant-guard';
import { fetchRoleArchitectBootstrap } from '@/features/role-architect/actions/roleArchitectActions';
import { RoleArchitectClient } from '@/features/role-architect/components/RoleArchitectClient';

export default async function AdminRolesPage() {
  await requireAdminSession();
  const initial = await fetchRoleArchitectBootstrap();
  const t = await getTranslations('Admin.rolesPage');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white/90 tracking-tight">{t('title')}</h1>
        <p className="text-sm text-white/40 mt-1 max-w-2xl leading-relaxed">{t('description')}</p>
      </div>
      <RoleArchitectClient initial={initial} />
    </div>
  );
}
