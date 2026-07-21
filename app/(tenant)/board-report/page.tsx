import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { buildBoardReport } from '@/lib/reports/board-report';
import { BoardReportView } from '@/features/mono-report/components/BoardReportView';
import { BoardReportActions } from '@/features/mono-report/components/BoardReportActions';
import type { Tenant } from '@/types/tenant';

/** AI-generated board report is always fresh (live data + narrative). */
export const dynamic = 'force-dynamic';

export default async function BoardReportPage() {
  const { companyId, tenant: tenantCtx } = await requireTenantContext();
  const tenant = tenantCtx as Tenant;
  const report = await buildBoardReport(companyId, tenant.name, tenant.currency ?? undefined);

  return (
    <div className="space-y-5">
      <BoardReportActions />
      <BoardReportView report={report} brandLogoUrl={tenant.brand_logo_url ?? null} />
    </div>
  );
}
