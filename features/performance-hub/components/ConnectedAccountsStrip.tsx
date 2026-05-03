import { getTranslations } from 'next-intl/server';
import { GlassCard } from '@/components/shared/GlassCard';
import { fetchConnectedAdAccounts } from '../actions/fetchMetrics';
import { AdPlatformDock } from './AdPlatformDock';

interface ConnectedAccountsStripProps {
  companyId: string;
}

export async function ConnectedAccountsStrip({ companyId }: ConnectedAccountsStripProps) {
  const t        = await getTranslations('Performance.connectedAccounts');
  const accounts = await fetchConnectedAdAccounts(companyId);

  return (
    <GlassCard padding="md" className="bento-card relative z-[1] isolate w-full min-w-0">
      <div className="mb-3 space-y-1">
        <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em]">
          {t('title')}
        </p>
        {!accounts.length ? (
          <p className="text-[11px] text-white/40 leading-relaxed max-w-xl">{t('disconnectDescription')}</p>
        ) : null}
      </div>
      <AdPlatformDock accounts={accounts} className="justify-start sm:justify-start" />
    </GlassCard>
  );
}
