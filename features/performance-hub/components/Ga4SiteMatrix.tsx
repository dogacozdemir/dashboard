import { getTranslations } from 'next-intl/server';
import { fetchGa4Snapshot } from '../actions/fetchMetrics';
import { GlassCard } from '@/components/shared/GlassCard';
import { formatCurrency } from '@/lib/utils/format';

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}dk ${String(s % 60).padStart(2, '0')}sn` : `${s}sn`;
}

/**
 * GA4 is the site-side counterpart to ad spend: what actually happened after
 * the click. Real tenants without a connected property get an honest empty
 * state — never fabricated sessions.
 */
export async function Ga4SiteMatrix({
  companyId,
  currency,
}: {
  companyId: string;
  currency?: string | null;
}) {
  const t = await getTranslations('Performance.cockpit.ga4Matrix');
  const data = await fetchGa4Snapshot(companyId);

  const nf = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });

  const cells = [
    { key: 'sessions', title: t('sessionsTitle'), value: nf(data.sessions), hint: t('sessionsHint') },
    { key: 'users', title: t('usersTitle'), value: nf(data.activeUsers), hint: t('usersHint') },
    { key: 'newUsers', title: t('newUsersTitle'), value: nf(data.newUsers), hint: t('newUsersHint') },
    {
      key: 'engagement',
      title: t('engagementTitle'),
      value: `${data.engagementRatePct.toFixed(1)}%`,
      hint: t('engagementHint'),
    },
    {
      key: 'duration',
      title: t('durationTitle'),
      value: formatDuration(data.avgSessionSecs),
      hint: t('durationHint'),
    },
    {
      key: 'conversions',
      title: t('conversionsTitle'),
      value: nf(data.conversions),
      hint: t('conversionsHint'),
    },
  ];

  const hasSignal = data.sessions > 0 || data.activeUsers > 0;
  const topSessions = data.channels[0]?.sessions ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">{t('sectionTitle')}</h2>
        <p className="text-[11px] text-white/38 mt-1 max-w-2xl leading-relaxed">
          {data.propertyName ? t('sectionSubtitleNamed', { property: data.propertyName }) : t('sectionSubtitle')}
        </p>
      </div>

      {!data.connected ? (
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
          <p className="text-sm text-white/42 text-center max-w-md mx-auto leading-relaxed">
            {t('emptyConnected')}
          </p>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {cells.map((c) => (
              <GlassCard
                key={c.key}
                padding="md"
                className="bento-card rounded-[2rem] border-white/10 backdrop-blur-3xl saturate-200"
              >
                <p className="text-[10px] font-semibold text-white/38 uppercase tracking-[0.14em]">{c.title}</p>
                <p className="text-2xl font-bold text-white/90 tabular-nums mt-2">{c.value}</p>
                <p className="text-[11px] text-white/42 leading-relaxed mt-3">{c.hint}</p>
              </GlassCard>
            ))}
          </div>

          {data.channels.length > 0 ? (
            <GlassCard padding="none" className="bento-card rounded-[2rem] border-white/10 backdrop-blur-3xl">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white/80">{t('channelsTitle')}</h3>
                <p className="text-[11px] text-white/38 mt-0.5">{t('channelsSubtitle')}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      {[t('colChannel'), t('colSessions'), t('colConversions'), t('colRevenue')].map((h, i) => (
                        <th
                          key={h}
                          className={`px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((c) => (
                      <tr key={c.channel} className="border-b border-white/[0.03]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-1.5 rounded-full bg-gradient-to-r from-[#9c70b2] to-[#bea042]"
                              style={{
                                width: `${topSessions > 0 ? Math.max(8, Math.round((c.sessions / topSessions) * 64)) : 8}px`,
                              }}
                              aria-hidden
                            />
                            <span className="text-sm text-white/80">{c.channel}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-white/70 tabular-nums">{nf(c.sessions)}</td>
                        <td className="px-5 py-3 text-right text-sm text-white/70 tabular-nums">{nf(c.conversions)}</td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-[#bea042] tabular-nums">
                          {formatCurrency(c.revenue, currency ?? undefined)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          ) : null}
        </>
      )}
    </div>
  );
}
