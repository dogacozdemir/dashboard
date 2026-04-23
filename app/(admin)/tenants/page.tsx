import { fetchAllTenants } from '@/features/admin/actions/fetchAdmin';
import { TenantTable } from '@/features/admin/components/TenantTable';

export default async function AdminTenantsPage() {
  const tenants = await fetchAllTenants();

  const active   = tenants.filter((t) => t.is_active).length;
  const enterprise = tenants.filter((t) => t.plan === 'enterprise').length;
  const growth   = tenants.filter((t) => t.plan === 'growth').length;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Tenants',  value: tenants.length, color: 'text-white/80' },
          { label: 'Active',         value: active,         color: 'text-emerald-400' },
          { label: 'Enterprise',     value: enterprise,     color: 'text-indigo-400' },
          { label: 'Growth',         value: growth,         color: 'text-cyan-400' },
        ].map((stat) => (
          <div key={stat.label} className="glass glow-inset rounded-2xl p-5">
            <p className="text-xs text-white/40 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <TenantTable tenants={tenants} />
    </div>
  );
}
