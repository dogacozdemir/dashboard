'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TimeRange } from '../actions/fetchMetrics';
import type { CockpitPlatform } from '../lib/cockpit-platform';

interface ExportMonoReportButtonProps {
  range: TimeRange;
  cockpit: CockpitPlatform;
}

export function ExportMonoReportButton({ range, cockpit }: ExportMonoReportButtonProps) {
  const t = useTranslations('Performance.cockpit.monoReport');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ range, platform: cockpit });
      const res = await fetch(`/api/reports/mono-report?${qs.toString()}`, { method: 'GET' });
      if (!res.ok) {
        const body = await res.text();
        console.error('[mono Report]', res.status, body);
        setError(t('exportFailed'));
        return;
      }
      const ct = res.headers.get('Content-Type') ?? '';
      if (!ct.includes('application/pdf')) {
        console.error('[mono Report] unexpected content-type', ct);
        setError(t('exportFailed'));
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      const match = cd?.match(/filename="([^"]+)"/);
      const name = match?.[1] ?? 'mono-report.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[mono Report] network', e);
      setError(t('exportFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
    <button
      type="button"
      onClick={() => void onExport()}
      disabled={busy}
      aria-label={t('sr')}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[#bea042]/35 bg-gradient-to-r from-[#9c70b2]/18 to-[#bea042]/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-[#bea042]/55 hover:text-white disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 text-[#bea042]" />}
      <span>{busy ? t('busy') : t('export')}</span>
    </button>
      {error ? <span className="max-w-[220px] text-right text-[10px] text-rose-300/90">{error}</span> : null}
    </span>
  );
}
