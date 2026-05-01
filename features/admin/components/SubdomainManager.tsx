'use client';

import { motion } from 'framer-motion';
import { Globe, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import type { TenantWithStats } from '../types';

interface SubdomainManagerProps {
  tenants: TenantWithStats[];
}

export function SubdomainManager({ tenants }: SubdomainManagerProps) {
  const t = useTranslations('Admin.subdomainRegistry');

  return (
    <GlassCard padding="none">
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white/80">{t('title')}</h3>
        <p className="text-xs text-white/30 mt-0.5">{t('subtitle')}</p>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {tenants.map((tenant, i) => {
          const domain = tenant.custom_domain ?? `${tenant.slug}.madmonos.com`;
          const hasCustom = !!tenant.custom_domain;

          return (
            <motion.div
              key={tenant.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-indigo-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80">{tenant.name}</p>
                <p className="text-xs text-indigo-400 mt-0.5">{domain}</p>
                {hasCustom && (
                  <p className="text-[10px] text-white/25 mt-0.5">
                    {t('alias')} {tenant.slug}.madmonos.com
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">{t('ssl')}</span>
                </div>
                {tenant.is_active ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('live')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{t('inactive')}</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
}
