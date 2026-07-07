'use client';

import { useEffect, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, Loader2, Shield, SlidersHorizontal, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils/cn';
import { updateSystemSettings } from '../actions/adminSettingsActions';
import { SYSTEM_LOG_LEVELS, type SystemLogLevel, type SystemSettings } from '../types/system-settings';

const spring = { type: 'spring' as const, stiffness: 280, damping: 26 };

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
          <Icon className="h-4 w-4 text-[#bea042]/80" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/85">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/35">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-45',
          checked ? 'border-emerald-400/40 bg-emerald-500/25' : 'border-white/15 bg-white/[0.06]',
        )}
      >
        <motion.span
          layout
          transition={spring}
          className={cn(
            'absolute top-0.5 block h-5 w-5 rounded-full shadow-sm',
            checked ? 'left-[1.35rem] bg-emerald-300' : 'left-1 bg-white/50',
          )}
        />
      </button>
    </div>
  );
}

type Props = {
  initialSettings: SystemSettings;
};

export function AdminSettingsClient({ initialSettings }: Props) {
  const t = useTranslations('Admin.settings');
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  function applyPatch(patch: Parameters<typeof updateSystemSettings>[0]) {
    const prev = settings;
    setStatus(null);
    setSettings((s) => ({ ...s, ...patch }));

    startTransition(async () => {
      const res = await updateSystemSettings(patch);
      if (!res.success || !res.settings) {
        setSettings(prev);
        setStatus({ type: 'err', text: t('saveError') });
        return;
      }
      setSettings(res.settings);
      setStatus({ type: 'ok', text: t('saveSuccess') });
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/35">{t('eyebrow')}</p>
          {pending && <Loader2 className="size-3.5 animate-spin text-[#bea042]/80" aria-hidden />}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight gradient-text-indigo sm:text-3xl">{t('title')}</h1>
        <p className="text-sm leading-relaxed text-white/40">{t('subtitle')}</p>
      </header>

      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="status"
            className={cn(
              'flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm',
              status.type === 'ok'
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200/90'
                : 'border-rose-400/30 bg-rose-500/10 text-rose-200/90',
            )}
          >
            {status.type === 'ok' && <CheckCircle2 className="size-4 shrink-0" />}
            {status.text}
          </motion.div>
        )}
      </AnimatePresence>

      <GlassCard padding="lg" className="space-y-4">
        <div className="flex items-center gap-2 text-white/80">
          <SlidersHorizontal className="h-4 w-4 text-[#bea042]" />
          <h2 className="text-sm font-semibold">{t('platformSection')}</h2>
        </div>

        <ToggleRow
          icon={Bell}
          title={t('maintenanceTitle')}
          description={t('maintenanceDesc')}
          checked={settings.maintenanceMode}
          onChange={(v) => applyPatch({ maintenanceMode: v })}
          disabled={pending}
        />
        <ToggleRow
          icon={UserPlus}
          title={t('signupsTitle')}
          description={t('signupsDesc')}
          checked={settings.globalSignupsAllowed}
          onChange={(v) => applyPatch({ globalSignupsAllowed: v })}
          disabled={pending}
        />

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
              <Shield className="h-4 w-4 text-[#bea042]/80" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/85">{t('logLevelTitle')}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/35">{t('logLevelDesc')}</p>
              <select
                value={settings.systemLogLevel}
                onChange={(e) =>
                  applyPatch({ systemLogLevel: e.target.value as SystemLogLevel })
                }
                disabled={pending}
                className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-sm text-white/80 outline-none transition-colors focus:border-[#bea042]/40 disabled:cursor-not-allowed disabled:opacity-45 sm:max-w-xs"
              >
                {SYSTEM_LOG_LEVELS.map((level) => (
                  <option key={level} value={level} className="bg-[#161018]">
                    {t(`logLevel_${level}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
