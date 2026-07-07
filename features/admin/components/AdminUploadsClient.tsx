'use client';

import { FileText, HardDrive, Image, Upload, Video } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { formatFileSize } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { AdminStorageMetrics } from '../actions/adminStorageMetrics';

function mediaIcon(mediaType: string, source: string) {
  if (mediaType === 'video' || mediaType === 'reel') return Video;
  if (mediaType.includes('image') || mediaType === 'image' || mediaType === 'logo') return Image;
  if (source === 'creative') return Video;
  return FileText;
}

function formatGb(bytes: number): string {
  if (bytes <= 0) return '0 GB';
  const gb = bytes / 1_073_741_824;
  if (gb < 0.1) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${gb.toFixed(1)} GB`;
}

type Props = { metrics: AdminStorageMetrics };

export function AdminUploadsClient({ metrics }: Props) {
  const t = useTranslations('Admin.uploadsPage');
  const locale = useLocale();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-US';

  const overviewStats = [
    { label: t('statStorage'), value: formatGb(metrics.totalBytes), icon: HardDrive },
    { label: t('statFilesMonth'), value: metrics.filesThisMonth.toLocaleString(localeTag), icon: Upload },
    { label: t('statTenantsFiles'), value: metrics.tenantsWithFiles.toLocaleString(localeTag), icon: FileText },
  ];

  function formatUploadDate(iso: string) {
    return new Intl.DateTimeFormat(localeTag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {overviewStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass glow-inset flex items-center gap-4 rounded-2xl p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <Icon className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-white/40">{stat.label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-white/80">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <GlassCard padding="none">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-sm font-semibold text-white/80">{t('tenantBreakdownTitle')}</h3>
          <p className="mt-0.5 text-xs text-white/30">{t('tenantBreakdownSubtitle')}</p>
        </div>
        {metrics.tenantBreakdown.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-white/35">{t('emptyTenants')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {[t('colTenant'), t('colFiles'), t('colStorage')].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/28"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.tenantBreakdown.map((row) => (
                  <tr
                    key={row.tenantId}
                    className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-3.5 align-middle">
                      <p className="text-sm font-medium text-white/85">{row.tenantName}</p>
                      <p className="font-mono text-[10px] text-white/28">{row.tenantSlug}</p>
                    </td>
                    <td className="px-6 py-3.5 align-middle text-sm tabular-nums text-white/55">
                      {row.fileCount.toLocaleString(localeTag)}
                    </td>
                    <td className="px-6 py-3.5 align-middle text-sm tabular-nums text-white/70">
                      {row.totalBytes > 0 ? formatGb(row.totalBytes) : t('sizeUnknown')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard padding="none">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-sm font-semibold text-white/80">{t('recentTitle')}</h3>
          <p className="mt-0.5 text-xs text-white/30">{t('recentSubtitle')}</p>
        </div>
        {metrics.recentUploads.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-white/35">{t('emptyRecent')}</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {metrics.recentUploads.map((file) => {
              const Icon = mediaIcon(file.mediaType, file.source);
              return (
                <div
                  key={`${file.source}-${file.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                    <Icon className="h-4 w-4 text-white/40" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white/80">{file.fileName}</p>
                    <p className="mt-0.5 text-xs text-white/30">{file.tenantName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs tabular-nums text-white/50">
                      {file.fileSizeBytes != null && file.fileSizeBytes > 0
                        ? formatFileSize(file.fileSizeBytes)
                        : t('sizeUnknown')}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/25">{formatUploadDate(file.createdAt)}</p>
                  </div>
                  <span
                    className={cn(
                      'hidden shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:inline',
                      file.source === 'brand'
                        ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300/80'
                        : 'border-violet-500/25 bg-violet-500/10 text-violet-300/80',
                    )}
                  >
                    {file.source === 'brand' ? t('sourceBrand') : t('sourceCreative')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
