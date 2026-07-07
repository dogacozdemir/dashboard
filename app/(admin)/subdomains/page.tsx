import { getTranslations } from 'next-intl/server';
import { fetchAllTenants } from '@/features/admin/actions/fetchAdmin';
import { SubdomainManager } from '@/features/admin/components/SubdomainManager';
import { getPublicRootDomainParts } from '@/lib/utils/public-root-domain';

export default async function AdminSubdomainsPage() {
  const t = await getTranslations('Admin.subdomainsPage');
  const tenants = await fetchAllTenants();
  const { host: rootHost } = getPublicRootDomainParts();
  const withCustom = tenants.filter((row) => row.custom_domain).length;
  const active = tenants.filter((row) => row.is_active).length;

  const stats = [
    { label: t('statTotal'), value: tenants.length },
    { label: t('statCustom'), value: withCustom },
    { label: t('statWildcard'), value: `*.${rootHost}` },
    { label: t('statActive'), value: active },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass glow-inset rounded-2xl p-5">
            <p className="mb-1 text-xs text-white/40">{stat.label}</p>
            <p className="truncate text-xl font-bold tabular-nums text-white/80">{stat.value}</p>
          </div>
        ))}
      </div>

      <SubdomainManager tenants={tenants} rootHost={rootHost} />
    </div>
  );
}
