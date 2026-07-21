import { TenantLogoMark } from '@/components/branding/TenantLogoMark';
import type { BoardReport } from '@/lib/reports/board-report';
import { formatCurrency } from '@/lib/utils/format';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function ChangeChip({ changePct, positiveIsGood }: { changePct: number | null; positiveIsGood: boolean }) {
  if (changePct === null) {
    return <span className="text-[11px] text-white/25">—</span>;
  }
  const good = positiveIsGood ? changePct >= 0 : changePct <= 0;
  const arrow = changePct > 0 ? '▲' : changePct < 0 ? '▼' : '■';
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums"
      style={{ color: good ? '#6ee7b7' : '#fb7185' }}
    >
      {arrow} {Math.abs(changePct)}%
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bea042]/80">{children}</h2>
  );
}

/** Print-optimized, liquid-glass board report / presentation. Server component. */
export function BoardReportView({
  report,
  brandLogoUrl,
}: {
  report: BoardReport;
  brandLogoUrl?: string | null;
}) {
  return (
    <div
      className="board-report mx-auto w-full max-w-4xl space-y-6 text-white"
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      {/* ── Cover ── */}
      <section
        className="relative overflow-hidden rounded-[2rem] border border-white/[0.1] p-8 md:p-10"
        style={{
          background:
            'radial-gradient(120% 120% at 15% 10%, rgba(156,112,178,0.22), rgba(12,7,12,0) 55%), linear-gradient(145deg, rgba(29,15,29,0.85), rgba(12,7,12,0.9))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 70px rgba(0,0,0,0.45)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="flex items-center justify-between gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(145deg, rgba(156,112,178,0.95), rgba(190,160,66,0.95))' }}
          >
            <TenantLogoMark brandLogoUrl={brandLogoUrl} alt="" width={28} height={28} className="h-7 w-7" />
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-white/35">Yönetim Kurulu Raporu</p>
            <p className="text-[11px] text-white/30">{fmtDate(report.generatedAt)}</p>
          </div>
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight md:text-4xl">{report.tenantName}</h1>
        <p className="mt-2 text-sm text-white/45">
          Performans &amp; strateji özeti · {report.period.from} — {report.period.to}
        </p>
      </section>

      {/* ── Executive summary ── */}
      <section
        className="rounded-[1.75rem] border border-white/[0.08] p-6 md:p-7"
        style={{ background: 'rgba(255,255,255,0.03)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        <SectionTitle>Yönetici Özeti</SectionTitle>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">{report.narrative.executiveSummary}</p>
      </section>

      {/* ── KPI grid ── */}
      <section className="space-y-3">
        <SectionTitle>Temel Metrikler</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {report.kpis.map((kpi) => (
            <div
              key={kpi.key}
              className="rounded-2xl border border-white/[0.08] p-4"
              style={{ background: 'rgba(255,255,255,0.03)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{kpi.label}</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-white">{kpi.value}</p>
              <div className="mt-1">
                <ChangeChip changePct={kpi.changePct} positiveIsGood={kpi.positiveIsGood} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Performance commentary + platforms ── */}
      {(report.narrative.performanceCommentary || report.platforms.length > 0) && (
        <section
          className="space-y-4 rounded-[1.75rem] border border-white/[0.08] p-6 md:p-7"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <SectionTitle>Ücretli Medya</SectionTitle>
          {report.narrative.performanceCommentary && (
            <p className="text-sm leading-relaxed text-white/75">{report.narrative.performanceCommentary}</p>
          )}
          {report.platforms.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-white/35">
                    <th className="pb-2 font-semibold">Platform</th>
                    <th className="pb-2 text-right font-semibold">Harcama</th>
                    <th className="pb-2 text-right font-semibold">Gelir</th>
                    <th className="pb-2 text-right font-semibold">ROAS</th>
                    <th className="pb-2 text-right font-semibold">Dönüşüm</th>
                  </tr>
                </thead>
                <tbody>
                  {report.platforms.map((p) => (
                    <tr key={p.platform} className="border-t border-white/[0.06]">
                      <td className="py-2.5 font-medium capitalize text-white/80">{p.platform}</td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">{formatCurrency(p.spend, report.currency)}</td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">{formatCurrency(p.revenue, report.currency)}</td>
                      <td className="py-2.5 text-right tabular-nums text-[#bea042]">{p.roas.toFixed(2)}x</td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">{p.conversions.toLocaleString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── SEO ── */}
      {report.seo && (
        <section
          className="space-y-4 rounded-[1.75rem] border border-white/[0.08] p-6 md:p-7"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <SectionTitle>Organik &amp; SEO</SectionTitle>
          {report.narrative.seoCommentary && (
            <p className="text-sm leading-relaxed text-white/75">{report.narrative.seoCommentary}</p>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { l: 'Gösterim', v: report.seo.impressions.toLocaleString('tr-TR') },
              { l: 'Tıklama', v: report.seo.clicks.toLocaleString('tr-TR') },
              { l: 'CTR', v: `${report.seo.ctrPercent.toFixed(2)}%` },
              { l: 'Ort. pozisyon', v: report.seo.avgPosition > 0 ? report.seo.avgPosition.toFixed(1) : '—' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/35">{s.l}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white/85">{s.v}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Creative pipeline ── */}
      <section className="space-y-3">
        <SectionTitle>Kreatif Hattı</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: 'İncelemede', v: report.creative.pending, c: '#b48dc8' },
            { l: 'Onaylandı', v: report.creative.approved, c: '#6ee7b7' },
            { l: 'Revizyon', v: report.creative.revision, c: '#fb7185' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
              <p className="text-3xl font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-white/40">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recommendations ── */}
      {report.narrative.recommendations.length > 0 && (
        <section
          className="rounded-[1.75rem] border p-6 md:p-7"
          style={{
            background: 'linear-gradient(135deg, rgba(156,112,178,0.1), rgba(190,160,66,0.06))',
            borderColor: 'rgba(190,160,66,0.25)',
          }}
        >
          <SectionTitle>Önerilen Aksiyonlar</SectionTitle>
          <ol className="mt-3 space-y-2.5">
            {report.narrative.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[#1a0f00]"
                  style={{ background: 'linear-gradient(135deg, #d4b44c, #bea042)' }}
                >
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-white/80">{r}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="pb-4 text-center text-[11px] text-white/25">
        Madmonos · monoAI tarafından oluşturuldu · {fmtDate(report.generatedAt)}
      </footer>
    </div>
  );
}
