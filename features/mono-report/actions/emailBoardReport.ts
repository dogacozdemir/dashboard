'use server';

import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { buildBoardReport } from '@/lib/reports/board-report';
import { boardReportEmail } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';
import { getTenantDashboardUrl } from '@/lib/utils/tenant-urls';

/** AI board report → email a recipient (client stakeholder). Confirmation is in the UI. */
export async function emailBoardReport(recipient: string): Promise<{ success: boolean; error?: string }> {
  const { companyId, tenant } = await requireTenantContext();

  const to = recipient.trim().toLowerCase();
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Geçerli bir e-posta adresi girin.' };
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    return { success: false, error: 'E-posta gönderimi henüz yapılandırılmadı.' };
  }

  try {
    const report = await buildBoardReport(companyId, tenant.name, tenant.currency ?? undefined);
    const { subject, html } = boardReportEmail({
      tenantName: report.tenantName,
      executiveSummary: report.narrative.executiveSummary,
      kpis: report.kpis.map((k) => ({ label: k.label, value: k.value })),
      recommendations: report.narrative.recommendations,
      reportUrl: getTenantDashboardUrl(tenant.slug, '/board-report'),
    });
    const res = await sendEmail({ to, subject, html });
    if (!('sent' in res) || res.sent !== true) {
      return { success: false, error: 'E-posta gönderilemedi.' };
    }
    return { success: true };
  } catch (e) {
    console.error('[emailBoardReport]', e);
    return { success: false, error: e instanceof Error ? e.message : 'Beklenmeyen hata.' };
  }
}
