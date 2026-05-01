import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchBrandAssets } from '@/features/brand-vault/actions/fetchAssets';
import { AssetGrid } from '@/features/brand-vault/components/AssetGrid';
import { BrandUploadPanel } from '@/features/brand-vault/components/BrandUploadPanel';
import { BrandHealthMeter } from '@/features/gamification/components/BrandHealthMeter';
import { fetchBrandHealthScore } from '@/features/gamification/actions/fetchGamification';
import { formatDate } from '@/lib/utils/format';
import { Shield, Lock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function BrandVaultPage() {
  const { companyId, tenant } = await requireTenantContext();
  const t = await getTranslations('Features.BrandVaultPage');

  const [assets, healthScore] = await Promise.all([
    fetchBrandAssets(companyId),
    fetchBrandHealthScore(companyId),
  ]);

  const chron = [...assets].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const firstAt = chron[0]?.createdAt;
  const lastAt  = chron[chron.length - 1]?.createdAt;

  const stats = [
    { labelKey: 'statTotal' as const, value: assets.length },
    { labelKey: 'statPublic' as const, value: assets.filter((a) => a.isPublic).length },
    { labelKey: 'statPrivate' as const, value: assets.filter((a) => !a.isPublic).length },
  ];

  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-3xl p-6 border border-white/[0.10]"
        style={{
          background: 'rgba(29, 15, 29, 0.4)',
          backdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), inset 1px 0 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-[#bea042]/15" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(156,112,178,0.18)', border: '1px solid rgba(156,112,178,0.28)' }}
          >
            <Shield className="w-5 h-5 text-[#b48dc8]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white/85 tracking-tight">{t('heroTitle')}</h2>
            <p className="text-xs text-white/40 mt-0.5 line-clamp-2">
              {t('heroSubtitle', { tenant: tenant.name })}
            </p>
          </div>
          <div className="sm:ml-auto flex items-center gap-1.5 text-xs text-white/30">
            <Lock className="w-3 h-3 shrink-0" />
            <span>{t('encrypted')}</span>
          </div>
        </div>
      </div>

      <BrandHealthMeter assets={assets} score={healthScore} />

      {(firstAt || lastAt) && (
        <p className="text-[10px] text-white/28 px-0.5">
          {firstAt && (
            <>
              {t('firstUpload')} <span className="text-white/45">{formatDate(firstAt)}</span>
            </>
          )}
          {firstAt && lastAt && firstAt !== lastAt && ' · '}
          {lastAt && firstAt !== lastAt && (
            <>
              {t('lastUpdate')} <span className="text-white/45">{formatDate(lastAt)}</span>
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.labelKey}
            className="relative overflow-hidden rounded-3xl p-5 border border-white/[0.08]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.1em] mb-2 line-clamp-2">{t(stat.labelKey)}</p>
            <p className="text-2xl font-bold text-white/85 tabular-nums tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <BrandUploadPanel companyId={companyId} />

      <div>
        <h2 className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em] mb-4">
          {t('filesHeading')}
        </h2>
        <AssetGrid assets={assets} />
      </div>
    </div>
  );
}
