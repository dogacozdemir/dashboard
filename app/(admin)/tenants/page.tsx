import { getTranslations } from 'next-intl/server';
import { fetchAllTenants } from '@/features/admin/actions/fetchAdmin';
import { TenantTable } from '@/features/admin/components/TenantTable';

export default async function AdminTenantsPage() {
  const t = await getTranslations('Admin.tenantsPage');
  const tenants = await fetchAllTenants();

  const active = tenants.filter((row) => row.is_active).length;
  const enterprise = tenants.filter((row) => row.plan === 'enterprise').length;
  const growth = tenants.filter((row) => row.plan === 'growth').length;

  const stats = [
    { label: t('statTotal'), value: tenants.length, color: 'text-white/80' },
    { label: t('statActive'), value: active, color: 'text-emerald-400' },
    { label: t('statEnterprise'), value: enterprise, color: 'text-indigo-400' },
    { label: t('statGrowth'), value: growth, color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative rounded-[2rem] p-6 overflow-hidden"
            style={{
              background: 'rgba(29, 15, 29, 0.4)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 50px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(32px) saturate(180%)',
            }}
          >
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em] mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold tabular-nums tracking-tight ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <TenantTable tenants={tenants} />
    </div>
  );
}
