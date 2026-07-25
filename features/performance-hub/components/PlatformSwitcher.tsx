'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { CockpitPlatform } from '../lib/cockpit-platform';

const ALL_OPTIONS = [
  { value: 'all' as const, labelKey: 'all' as const },
  { value: 'meta' as const, labelKey: 'meta' as const },
  { value: 'google' as const, labelKey: 'google' as const },
  { value: 'tiktok' as const, labelKey: 'tiktok' as const },
  { value: 'seo' as const, labelKey: 'seo' as const },
];

interface PlatformSwitcherProps {
  current: CockpitPlatform;
  /**
   * Channels this tenant actually has connected. A brand that only runs Google
   * ads shouldn't see Meta/TikTok filters pointing at data that can't exist.
   * Undefined (legacy call sites) shows everything.
   */
  connected?: Array<'meta' | 'google' | 'tiktok'>;
}

export function PlatformSwitcher({ current, connected }: PlatformSwitcherProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const t            = useTranslations('Performance.cockpit.platform');

  function select(platform: CockpitPlatform) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('platform', platform);
    router.push(`${pathname}?${params.toString()}`);
  }

  const options = ALL_OPTIONS.filter((opt) => {
    if (!connected) return true;
    if (opt.value === 'all') return true;
    // SEO reads Search Console through the Google connection.
    if (opt.value === 'seo') return connected.includes('google');
    return connected.includes(opt.value);
  });

  // A single "all" pill is not a choice — hide the switcher entirely.
  if (options.length <= 1) return null;

  return (
    <div className="inline-flex flex-wrap items-center rounded-[2rem] bg-white/[0.05] border border-white/10 backdrop-blur-3xl saturate-200 p-0.5 gap-0.5">
      {options.map((opt) => (
        <motion.button
          key={opt.value}
          layout
          type="button"
          onClick={() => select(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-[1.35rem] text-[11px] font-semibold transition-colors tracking-wide',
            current === opt.value
              ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-500/35 shadow-[0_0_24px_rgba(52,211,153,0.12)]'
              : 'text-white/45 hover:text-white/75 border border-transparent',
          )}
        >
          {t(opt.labelKey)}
        </motion.button>
      ))}
    </div>
  );
}
