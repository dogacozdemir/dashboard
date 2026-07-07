import { getTranslations } from 'next-intl/server';
import { fetchAllTenants } from '@/features/admin/actions/fetchAdmin';
import { TenantTable } from '@/features/admin/components/TenantTable';
import { GlassCard } from '@/components/shared/GlassCard';

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
    <div className="cockpit-liquid-scope space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label} padding="lg" className="bento-card">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{stat.label}</p>
            <p className={`text-3xl font-bold tabular-nums tracking-tight ${stat.color}`}>{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      <TenantTable tenants={tenants} />
    </div>
  );
}
