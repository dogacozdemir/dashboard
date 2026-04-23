export type TenantPlan = 'starter' | 'growth' | 'enterprise';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  custom_domain: string | null;
  plan: TenantPlan;
  primary_color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TenantContext {
  tenant: Tenant;
  companyId: string;
}
