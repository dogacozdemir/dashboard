import { fetchAllTenants } from '@/features/admin/actions/fetchAdmin';
import { SubdomainManager } from '@/features/admin/components/SubdomainManager';

export default async function AdminSubdomainsPage() {
  const tenants = await fetchAllTenants();
  const withCustom = tenants.filter((t) => t.custom_domain).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Subdomains', value: tenants.length },
          { label: 'Custom Domains',   value: withCustom },
          { label: 'SSL Active',       value: tenants.filter((t) => t.is_active).length },
        ].map((stat) => (
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
