import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchCreativeAssets } from '@/features/creative-studio/actions/fetchAssets';
import { MediaGrid } from '@/features/creative-studio/components/MediaGrid';
import { CreativeUploadPanel } from '@/features/creative-studio/components/CreativeUploadPanel';

export default async function CreativePage() {
  const { companyId } = await requireTenantContext();
  const assets = await fetchCreativeAssets(companyId);

  const pending  = assets.filter((a) => a.status === 'pending').length;
  const approved = assets.filter((a) => a.status === 'approved').length;
  const revision = assets.filter((a) => a.status === 'revision').length;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Review', value: pending,  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Approved',       value: approved, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Needs Revision', value: revision, color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`glass glow-inset rounded-2xl p-5 border ${stat.bg}`}
          >
            <p className="text-xs text-white/40 mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Upload panel */}
      <CreativeUploadPanel companyId={companyId} />

      {/* Media grid */}
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          Creative Assets
        </h2>
        <MediaGrid assets={assets} companyId={companyId} />
      </div>
    </div>
  );
}
