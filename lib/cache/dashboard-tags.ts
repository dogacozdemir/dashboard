/** Tag for future unstable_cache / fetch tag invalidation after onboarding or sync. */
export function tenantDashboardMetricsTag(tenantId: string): string {
  return `madmonos-tenant-metrics-${tenantId}`;
}
