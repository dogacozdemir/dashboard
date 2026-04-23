import type { Tenant, TenantPlan } from '@/types/tenant';
import type { User } from '@/types/user';

export interface TenantWithStats extends Tenant {
  userCount: number;
  assetCount: number;
  campaignCount: number;
  lastActivity: string | null;
}

export interface SubdomainConfig {
  tenantId: string;
  slug: string;
  customDomain: string | null;
  nginxConfigured: boolean;
  sslActive: boolean;
}

export { TenantPlan };
export type { Tenant, User };
