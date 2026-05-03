export type TenantPlan = 'starter' | 'growth' | 'enterprise';

/** Magic Onboarding: dashboard emphasis (Overview metric order + spotlight). */
export type DashboardGoal = 'sales' | 'awareness' | 'cost';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  /** White-label shell logo (Brand Vault primary); empty → Madmonos default. */
  brand_logo_url?: string | null;
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
  /** Showroom tenant: analytics + gamification reads are simulated (no live ad/GSC data). */
  is_demo?: boolean;
}

export interface TenantContext {
  tenant: Tenant;
  companyId: string;
}
