import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { fetchGscSeoMatrix, type GscSeoMatrixData } from '../actions/fetchMetrics';
import { GlassCard } from '@/components/shared/GlassCard';

type GscInsightKey =
  | 'balanced'
  | 'nonBrandDominant'
  | 'brandDominant'
  | 'ctrOpportunity'
  | 'ctrStrong'
  | 'serpTop'
  | 'serpDepth'
  | 'lcpRisk'
  | 'lcpHealthy'
  | 'queriesQueued';

function pickGscInsight(data: GscSeoMatrixData): { key: GscInsightKey; pct?: number; lcp?: string } | null {
  if (!data.hasGoogleConnection) return null;

  const hasNumeric =
    data.impressions > 0 || data.clicks > 0 || data.avgPosition > 0 || data.cwv.lcp != null;
  const awaitingQueries = data.hasGoogleConnection && data.gscQueryRowCount === 0 && !hasNumeric;
  if (awaitingQueries) return { key: 'queriesQueued' };
  if (!hasNumeric && data.gscQueryRowCount > 0) return { key: 'queriesQueued' };
  if (data.impressions < 1 && !hasNumeric) return null;

  const nbRatio = data.impressions > 0 ? data.nonBrandImpressions / data.impressions : 0;
  const lcpRaw = data.cwv.lcp;

  if (lcpRaw != null && lcpRaw > 2.6) {
    return { key: 'lcpRisk', lcp: lcpRaw.toFixed(1) };
  }
  if (data.avgPosition > 0 && data.avgPosition <= 11) return { key: 'serpTop' };
  if (data.avgPosition >= 22) return { key: 'serpDepth' };
  if (data.impressions >= 5000 && data.ctrPercent < 2.1) return { key: 'ctrOpportunity' };
  if (data.impressions >= 1500 && data.ctrPercent >= 4.2) return { key: 'ctrStrong' };
  if (data.impressions >= 3000 && nbRatio >= 0.52) {
    return { key: 'nonBrandDominant', pct: Math.round(nbRatio * 100) };
  }
  if (data.impressions >= 3000 && nbRatio <= 0.22) return { key: 'brandDominant' };
  if (lcpRaw != null && lcpRaw > 0 && lcpRaw <= 2) {
    return { key: 'lcpHealthy', lcp: lcpRaw.toFixed(1) };
  }
  return { key: 'balanced' };
}

function formatGscInsight(
  tInsight: Awaited<ReturnType<typeof getTranslations>>,
  insight: { key: GscInsightKey; pct?: number; lcp?: string },
): string {
  switch (insight.key) {
    case 'nonBrandDominant':
      return tInsight('nonBrandDominant', { pct: insight.pct ?? 0 });
    case 'lcpRisk':
      return tInsight('lcpRisk', { lcp: insight.lcp ?? '—' });
    case 'lcpHealthy':
      return tInsight('lcpHealthy', { lcp: insight.lcp ?? '—' });
    case 'balanced':
      return tInsight('balanced');
    case 'brandDominant':
      return tInsight('brandDominant');
    case 'ctrOpportunity':
      return tInsight('ctrOpportunity');
    case 'ctrStrong':
      return tInsight('ctrStrong');
    case 'serpTop':
      return tInsight('serpTop');
    case 'serpDepth':
      return tInsight('serpDepth');
    case 'queriesQueued':
      return tInsight('queriesQueued');
  }
}

function GscLiquidBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.14] bg-gradient-to-br from-white/[0.10] to-white/[0.02] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      style={{ WebkitBackdropFilter: 'blur(20px) saturate(160%)' }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/90 shadow-[0_0_10px_rgba(103,232,249,0.85)] motion-safe:animate-pulse"
        aria-hidden
      />
      <span className="min-w-0 leading-snug">{children}</span>
    </span>
  );
}

export async function SeoGscMatrix({
  companyId,
  tenantBrandName,
}: {
  companyId: string;
  tenantBrandName: string | null;
}) {
  const t = await getTranslations('Performance.cockpit.seoMatrix');
  const tInsight = await getTranslations('Performance.cockpit.seoMatrix.insights');
  const data = await fetchGscSeoMatrix(companyId, tenantBrandName);

  const awaitingGscQueries = data.hasGoogleConnection && data.gscQueryRowCount === 0;
  const hasNumericOrganic  = data.impressions > 0 || data.clicks > 0;

  const cells: Array<{
    key: string;
    title: string;
    hint: string;
    body: ReactNode;
    sub?: ReactNode | null;
  }> = [
    {
      key: 'impressions',
      title: t('impressionsTitle'),
      hint: t('impressionsHint'),
      body:
        awaitingGscQueries && !hasNumericOrganic ? (
          <div className="mt-2 flex flex-col items-start gap-2">
            <span className="text-2xl font-bold text-white/35 tabular-nums">0</span>
            <GscLiquidBadge>{t('badgeGscSyncing')}</GscLiquidBadge>
          </div>
        ) : (
          <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">
            {data.impressions.toLocaleString()}
          </p>
        ),
    },
    {
      key: 'nonBrand',
      title: t('nonBrandTitle'),
      hint: t('nonBrandHint'),
      body: (
        <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">
          {data.nonBrandImpressions.toLocaleString()}
        </p>
      ),
    },
    {
      key: 'position',
      title: t('positionTitle'),
      hint: t('positionHint'),
      body:
        !hasNumericOrganic ? (
          <div className="mt-2 flex flex-col items-start gap-2">
            <span className="text-2xl font-bold text-white/30 tabular-nums">0</span>
            <GscLiquidBadge>
              {awaitingGscQueries ? t('badgeGscSyncing') : t('badgePositionCalibrating')}
            </GscLiquidBadge>
          </div>
        ) : data.avgPosition > 0 ? (
          <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">{data.avgPosition.toFixed(1)}</p>
        ) : (
          <div className="mt-2 flex flex-col items-start gap-2">
            <p className="text-2xl font-bold text-white/55 tabular-nums">0.0</p>
            <GscLiquidBadge>{t('badgePositionCalibrating')}</GscLiquidBadge>
          </div>
        ),
    },
    {
      key: 'clicks',
      title: t('clicksTitle'),
      hint: t('clicksHint'),
      body:
        awaitingGscQueries && !hasNumericOrganic ? (
          <div className="mt-2 flex flex-col items-start gap-2">
            <span className="text-2xl font-bold text-white/35 tabular-nums">0</span>
            <GscLiquidBadge>{t('badgeGscSyncing')}</GscLiquidBadge>
          </div>
        ) : (
          <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">{data.clicks.toLocaleString()}</p>
        ),
    },
    {
      key: 'ctr',
      title: t('ctrTitle'),
      hint: t('ctrHint'),
      body:
        !hasNumericOrganic ? (
          <div className="mt-2 flex flex-col items-start gap-2">
            <span className="text-2xl font-bold text-white/35 tabular-nums">0.00%</span>
            <GscLiquidBadge>{t('badgeCtrAwaiting')}</GscLiquidBadge>
          </div>
        ) : (
          <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">{`${data.ctrPercent.toFixed(2)}%`}</p>
        ),
    },
    {
      key: 'indexing',
      title: t('indexingTitle'),
      hint: t('indexingHint'),
      body:
        data.indexingIssues == null ? (
          <div className="mt-2 flex flex-col items-start gap-2">
            <GscLiquidBadge>{t('badgeIndexingPipeline')}</GscLiquidBadge>
            <p className="text-[11px] text-white/38 leading-relaxed">{t('indexingFootnote')}</p>
          </div>
        ) : (
          <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">{String(data.indexingIssues)}</p>
        ),
    },
    {
      key: 'cwv',
      title: t('cwvTitle'),
      hint: t('cwvHint'),
      body:
        data.cwv.lcp != null ? (
          <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">{`LCP ${data.cwv.lcp}s`}</p>
        ) : (
          <div className="mt-2 flex flex-col items-start gap-2">
            <GscLiquidBadge>{t('badgeCwvAwaiting')}</GscLiquidBadge>
            <p className="text-[11px] text-white/38 leading-relaxed">{t('cwvFootnote')}</p>
          </div>
        ),
      sub:
        data.cwv.lcp != null ? (
          <p className="text-[10px] text-white/28 mt-1 tabular-nums">
            {t('cwvSubLine', {
              cls: data.cwv.cls != null ? String(data.cwv.cls) : t('valuePending'),
              fid: data.cwv.fidMs != null ? String(data.cwv.fidMs) : t('valuePending'),
            })}
          </p>
        ) : (
          <p className="text-[10px] text-white/28 mt-1 tabular-nums">{t('cwvSubWhenMissing')}</p>
        ),
    },
  ];

  const hasSignal =
    data.hasGoogleConnection ||
    data.gscQueryRowCount > 0 ||
    data.impressions > 0 ||
    data.clicks > 0 ||
    data.avgPosition > 0 ||
    data.cwv.lcp != null;

  const insightPick = pickGscInsight(data);
  const insightText =
    insightPick && hasSignal && insightPick.key !== 'queriesQueued'
      ? formatGscInsight(tInsight, insightPick)
      : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">{t('sectionTitle')}</h2>
        <p className="text-[11px] text-white/38 mt-1 max-w-2xl leading-relaxed">{t('sectionSubtitle')}</p>
      </div>

      {insightText ? (
        <blockquote
          className="rounded-[1.25rem] border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.07] to-[#9c70b2]/[0.06] px-4 py-3 text-[12px] leading-relaxed text-white/72 backdrop-blur-xl md:px-5"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
        >
          <span className="font-semibold text-cyan-200/90">{t('insightEyebrow')}</span>
          <span className="text-white/35"> — </span>
          {insightText}
        </blockquote>
      ) : null}

      {!data.hasGoogleConnection ? (
        <GlassCard
          padding="lg"
          className="bento-card rounded-[2rem] border-white/10 border-dashed backdrop-blur-3xl"
        >
          <p className="text-sm text-white/40 text-center">{t('empty')}</p>
        </GlassCard>
      ) : !hasSignal ? (
        <GlassCard
          padding="lg"
          className="bento-card rounded-[2rem] border-white/10 border-dashed backdrop-blur-3xl"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <GscLiquidBadge>{t('badgeGscSyncing')}</GscLiquidBadge>
            <p className="text-sm text-white/42 max-w-md leading-relaxed">{t('emptyConnected')}</p>
          </div>
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
              {c.body}
              {c.sub ? <div className="mt-1">{c.sub}</div> : null}
              <p className="text-[11px] text-white/42 leading-relaxed mt-3">{c.hint}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
