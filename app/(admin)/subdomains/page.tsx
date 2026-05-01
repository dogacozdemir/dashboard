import { getTranslations } from 'next-intl/server';
import { fetchAllTenants } from '@/features/admin/actions/fetchAdmin';
import { SubdomainManager } from '@/features/admin/components/SubdomainManager';

export default async function AdminSubdomainsPage() {
  const t = await getTranslations('Admin.subdomainsPage');
  const tenants = await fetchAllTenants();
  const withCustom = tenants.filter((row) => row.custom_domain).length;

  const stats = [
    { label: t('statTotal'), value: tenants.length },
    { label: t('statCustom'), value: withCustom },
    { label: t('statSsl'), value: tenants.filter((row) => row.is_active).length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass glow-inset rounded-2xl p-5">
            <p className="text-xs text-white/40 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-white/80">{stat.value}</p>
          </div>
        ))}
      </div>

      <SubdomainManager tenants={tenants} />
    </div>
  );
}
