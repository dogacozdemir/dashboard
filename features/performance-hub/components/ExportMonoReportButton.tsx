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

  async function onExport() {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ range, platform: cockpit });
      const res = await fetch(`/api/reports/mono-report?${qs.toString()}`, { method: 'GET' });
      if (!res.ok) {
        console.error('[mono Report]', await res.text());
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
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}
