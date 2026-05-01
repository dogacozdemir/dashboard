import { auth } from '@/lib/auth/config';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { fetchCreativeAssets } from '@/features/creative-studio/actions/fetchAssets';
import { MediaGrid } from '@/features/creative-studio/components/MediaGrid';
import { CreativeUploadPanel } from '@/features/creative-studio/components/CreativeUploadPanel';
import type { SessionUser } from '@/types/user';
import { getTranslations } from 'next-intl/server';

export default async function CreativePage() {
  const { companyId } = await requireTenantContext();
  const t = await getTranslations('Features.CreativePage');
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const canApproveCreative = sessionHasPermission(user, 'creative.approve');
  const canDeleteCreative = user?.role === 'super_admin';

  const assets = await fetchCreativeAssets(companyId);

  const pending  = assets.filter((a) => a.status === 'pending').length;
  const approved = assets.filter((a) => a.status === 'approved').length;
  const revision = assets.filter((a) => a.status === 'revision').length;

  const stats = [
    {
      labelKey: 'statPending' as const,
      value: pending,
      color: 'text-[#b48dc8]',
      glowColor: 'rgba(156,112,178,0.18)',
      borderColor: 'rgba(156,112,178,0.2)',
      bg: 'rgba(156,112,178,0.06)',
      dot: '#9c70b2',
    },
    {
      labelKey: 'statApproved' as const,
      value: approved,
      color: 'text-emerald-400',
      glowColor: 'rgba(16,185,129,0.15)',
      borderColor: 'rgba(16,185,129,0.18)',
      bg: 'rgba(16,185,129,0.05)',
      dot: '#10B981',
    },
    {
      labelKey: 'statRevision' as const,
      value: revision,
      color: 'text-rose-400',
      glowColor: 'rgba(244,63,94,0.12)',
      borderColor: 'rgba(244,63,94,0.18)',
      bg: 'rgba(244,63,94,0.05)',
      dot: '#F43F5E',
    },
  ];

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.labelKey}
            className="relative rounded-3xl p-6 overflow-hidden"
            style={{
              background: stat.bg,
              border: `1px solid ${stat.borderColor}`,
              boxShadow: `0 0 24px ${stat.glowColor}, inset 0 1px 0 rgba(255,255,255,0.1), inset 1px 0 0 rgba(255,255,255,0.05)`,
              backdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em] mb-3 line-clamp-2">
              {t(stat.labelKey)}
            </p>
            <p className={`text-4xl font-bold tabular-nums tracking-tight ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <CreativeUploadPanel companyId={companyId} />

      <div>
        <h2 className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em] mb-5">
          {t('assetsHeading')}
        </h2>
        <MediaGrid
          assets={assets}
          companyId={companyId}
          canApproveCreative={canApproveCreative}
          canDeleteCreative={canDeleteCreative}
        />
      </div>
    </div>
  );
}
