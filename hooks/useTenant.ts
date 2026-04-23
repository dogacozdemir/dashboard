'use client';

import { createContext, useContext } from 'react';
import type { TenantContext } from '@/types/tenant';

const TenantCtx = createContext<TenantContext | null>(null);

export const TenantProvider = TenantCtx.Provider;

export function useTenant(): TenantContext {
  const ctx = useContext(TenantCtx);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
