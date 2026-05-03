'use client';

import { LayoutGroup, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { TimeRange } from '../actions/fetchMetrics';
import type { CockpitPlatform } from '../lib/cockpit-platform';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PlatformSwitcher } from './PlatformSwitcher';
import { ExportMonoReportButton } from './ExportMonoReportButton';

interface CockpitToolbarProps {
  currentRange: TimeRange;
  currentPlatform: CockpitPlatform;
  /** When true, show mono Report PDF export (Performance Hub + Dashboard). */
  showMonoReportExport?: boolean;
}

export function CockpitToolbar({
  currentRange,
  currentPlatform,
  showMonoReportExport = false,
}: CockpitToolbarProps) {
  const t = useTranslations('Performance.cockpit.toolbarHint');

  return (
    <LayoutGroup id="cockpit-shell">
      <motion.div
        layout
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4"
      >
        <p className="sr-only">{t('srFilters')}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showMonoReportExport ? (
            <ExportMonoReportButton range={currentRange} cockpit={currentPlatform} />
          ) : null}
          <TimeRangeFilter current={currentRange} />
          <PlatformSwitcher current={currentPlatform} />
        </div>
      </motion.div>
    </LayoutGroup>
  );
}
