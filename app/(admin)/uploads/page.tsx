import { getTranslations } from 'next-intl/server';
import { GlassCard } from '@/components/shared/GlassCard';
import { Upload, FileText, Image, Video, HardDrive } from 'lucide-react';

const recentUploads = [
  { name: 'Brand Book v2.1.pdf', tenant: 'Acme Corp', size: '24.0 MB', type: 'pdf', timeKey: 'demoTime2h' as const },
  { name: 'Summer Hero Video.mp4', tenant: 'Brand X', size: '128 MB', type: 'video', timeKey: 'demoTime5h' as const },
  { name: 'Product Banner Pack.zip', tenant: 'Nova Digital', size: '8.4 MB', type: 'image', timeKey: 'demoTime1d' as const },
  { name: 'Logo SVG Variations.zip', tenant: 'Acme Corp', size: '2.1 MB', type: 'image', timeKey: 'demoTime2d' as const },
  { name: 'TikTok Campaign Cut.mp4', tenant: 'Brand X', size: '64 MB', type: 'video', timeKey: 'demoTime3d' as const },
] as const;

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  video: Video,
  image: Image,
};

export default async function AdminUploadsPage() {
  const t = await getTranslations('Admin.uploadsPage');

  const overviewStats = [
    { label: t('statStorage'), value: '12.4 GB', icon: HardDrive },
    { label: t('statFilesMonth'), value: '47', icon: Upload },
    { label: t('statTenantsFiles'), value: '3', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {overviewStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass glow-inset rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-white/40">{stat.label}</p>
                <p className="text-xl font-bold text-white/80 mt-0.5">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <GlassCard padding="none">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white/80">{t('recentTitle')}</h3>
          <p className="text-xs text-white/30 mt-0.5">{t('recentSubtitle')}</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {recentUploads.map((file, i) => {
            const Icon = typeIcon[file.type] ?? FileText;
            return (
              <div
                key={i}
                className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{file.name}</p>
                  <p className="text-xs text-white/30 mt-0.5">{file.tenant}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50">{file.size}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{t(file.timeKey)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
