import { getTranslations } from 'next-intl/server';
import { fetchGscSeoMatrix } from '../actions/fetchMetrics';
import { GlassCard } from '@/components/shared/GlassCard';

export async function SeoGscMatrix({
  companyId,
  tenantBrandName,
}: {
  companyId: string;
  tenantBrandName: string | null;
}) {
  const t    = await getTranslations('Performance.cockpit.seoMatrix');
  const data = await fetchGscSeoMatrix(companyId, tenantBrandName);

  const cells = [
    {
      key: 'impressions',
      value: data.impressions.toLocaleString(),
      title: t('impressionsTitle'),
      hint: t('impressionsHint'),
    },
    {
      key: 'nonBrand',
      value: data.nonBrandImpressions.toLocaleString(),
      title: t('nonBrandTitle'),
      hint: t('nonBrandHint'),
    },
    {
      key: 'position',
      value: data.avgPosition > 0 ? data.avgPosition.toFixed(1) : '—',
      title: t('positionTitle'),
      hint: t('positionHint'),
    },
    {
      key: 'clicks',
      value: data.clicks.toLocaleString(),
      title: t('clicksTitle'),
      hint: t('clicksHint'),
    },
    {
      key: 'ctr',
      value: `${data.ctrPercent.toFixed(2)}%`,
      title: t('ctrTitle'),
      hint: t('ctrHint'),
    },
    {
      key: 'indexing',
      value: data.indexingIssues == null ? '—' : String(data.indexingIssues),
      title: t('indexingTitle'),
      hint: t('indexingHint'),
    },
    {
      key: 'cwv',
      value: data.cwv.lcp != null ? `LCP ${data.cwv.lcp}s` : '—',
      title: t('cwvTitle'),
      hint: t('cwvHint'),
      sub:
        data.cwv.cls != null || data.cwv.fidMs != null
          ? `CLS ${data.cwv.cls ?? '—'} · FID ${data.cwv.fidMs ?? '—'}ms`
          : null,
    },
  ];

  const hasSignal =
    data.impressions > 0 ||
    data.clicks > 0 ||
    data.avgPosition > 0 ||
    data.cwv.lcp != null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">{t('sectionTitle')}</h2>
        <p className="text-[11px] text-white/35 mt-1 max-w-2xl leading-relaxed">{t('sectionSubtitle')}</p>
      </div>

      {!hasSignal ? (
        <GlassCard
          padding="lg"
          className="bento-card rounded-[2rem] border-white/10 border-dashed backdrop-blur-3xl"
        >
          <p className="text-sm text-white/40 text-center">{t('empty')}</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cells.map((c) => (
            <GlassCard
              key={c.key}
              padding="md"
              className="bento-card rounded-[2rem] border-white/10 backdrop-blur-3xl saturate-200"
            >
              <p className="text-[10px] font-semibold text-white/38 uppercase tracking-[0.14em]">{c.title}</p>
              <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">{c.value}</p>
              {c.sub ? <p className="text-[10px] text-white/28 mt-1 tabular-nums">{c.sub}</p> : null}
              <p className="text-[11px] text-white/42 leading-relaxed mt-3">{c.hint}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
