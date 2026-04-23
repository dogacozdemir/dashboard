import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchBrandAssets } from '@/features/brand-vault/actions/fetchAssets';
import { AssetGrid } from '@/features/brand-vault/components/AssetGrid';
import { BrandUploadPanel } from '@/features/brand-vault/components/BrandUploadPanel';
import { BrandHealthMeter } from '@/features/gamification/components/BrandHealthMeter';
import { fetchBrandHealthScore } from '@/features/gamification/actions/fetchGamification';
import { Shield, Lock } from 'lucide-react';

export default async function BrandVaultPage() {
  const { companyId, tenant } = await requireTenantContext();
  const [assets, healthScore] = await Promise.all([
    fetchBrandAssets(companyId),
    fetchBrandHealthScore(companyId),
  ]);

  return (
    <div className="space-y-6">
      {/* Vault header */}
      <div className="glass glow-inset rounded-2xl p-6 border border-indigo-500/10 bg-gradient-to-r from-indigo-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/80">Brand Vault</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Secure brand assets for <span className="text-indigo-300">{tenant.name}</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-white/30">
            <Lock className="w-3 h-3" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>

      {/* Brand Health */}
      <BrandHealthMeter assets={assets} score={healthScore} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Assets',    value: assets.length },
          { label: 'Public Assets',   value: assets.filter((a) => a.isPublic).length },
          { label: 'Private Assets',  value: assets.filter((a) => !a.isPublic).length },
        ].map((stat) => (
          <div key={stat.label} className="glass glow-inset rounded-2xl p-5">
            <p className="text-xs text-white/40 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-white/80">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Upload panel */}
      <BrandUploadPanel companyId={companyId} />

      {/* Asset grid */}
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          Brand Assets
        </h2>
        <AssetGrid assets={assets} />
      </div>
    </div>
  );
}
