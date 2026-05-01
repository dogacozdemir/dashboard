export type TenantPlan = 'starter' | 'growth' | 'enterprise';

/** Magic Onboarding: dashboard emphasis (Overview metric order + spotlight). */
export type DashboardGoal = 'sales' | 'awareness' | 'cost';

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
  /** Optional vertical (onboarding / MonoAI copy). */
  industry?: string | null;
  /** Primary growth goal chosen in Magic Onboarding. */
  dashboard_goal?: DashboardGoal | null;
  magic_onboarding_completed_at?: string | null;
}

export interface TenantContext {
  tenant: Tenant;
  companyId: string;
}
