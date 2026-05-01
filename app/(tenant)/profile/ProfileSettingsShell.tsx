'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { MobileFirstSheet } from '@/components/layout/MobileFirstSheet';

export function ProfileSettingsShell({ children }: { children: ReactNode }) {
  const t = useTranslations('Common.commandNav');
  return <MobileFirstSheet title={t('profileSettings')}>{children}</MobileFirstSheet>;
}
