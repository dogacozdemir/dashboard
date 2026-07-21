import 'server-only';

/**
 * Branded HTML email templates. Inline styles + table layout for client
 * compatibility (Gmail/Outlook/Apple Mail). Dark, on-brand look.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface BaseEmailInput {
  previewText?: string;
  heading: string;
  /** Paragraphs (plain text; escaped). */
  paragraphs: string[];
  /** Trusted, pre-built HTML inserted after the paragraphs (caller-controlled). */
  extraHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export function baseEmail({
  previewText,
  heading,
  paragraphs,
  extraHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
}: BaseEmailInput): string {
  const preview = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>`
    : '';

  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#c9c2cf;font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`,
    )
    .join('');

  const cta =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
           <tr><td style="border-radius:14px;background:linear-gradient(90deg,#9c70b2,#bea042);">
             <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;color:#fff;font-weight:600;font-size:14px;text-decoration:none;border-radius:14px;">${escapeHtml(ctaLabel)}</a>
           </td></tr>
         </table>`
      : '';

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0c070c;">
${preview}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c070c;padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#160a16;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <tr><td style="padding:22px 28px 6px;">
        <span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;background:linear-gradient(90deg,#b48dc8,#bea042);-webkit-background-clip:text;background-clip:text;color:#b48dc8;">madmonos</span>
      </td></tr>
      <tr><td style="padding:8px 28px 24px;">
        <h1 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">${escapeHtml(heading)}</h1>
        ${body}
        ${extraHtml ?? ''}
        ${cta}
      </td></tr>
      <tr><td style="padding:16px 28px 24px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;color:#6b6470;font-size:12px;line-height:1.5;">${escapeHtml(footerNote ?? 'You are receiving this because you are a member of a Madmonos workspace.')}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function statPill(label: string, value: string, changePct: number): string {
  const color = changePct > 0 ? '#6ee7b7' : changePct < 0 ? '#fb7185' : '#9ca3af';
  const arrow = changePct > 0 ? '▲' : changePct < 0 ? '▼' : '■';
  return `<td style="padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;">
    <div style="color:#8a828f;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(label)}</div>
    <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(value)}</div>
    <div style="color:${color};font-size:12px;margin-top:2px;">${arrow} ${Math.abs(changePct)}%</div>
  </td>`;
}

export function weeklyDigestEmail(input: {
  tenantName: string;
  narrative: string;
  actions: string[];
  spend: string;
  revenue: string;
  roas: string;
  spendChangePct: number;
  revenueChangePct: number;
  roasChangePct: number;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const stats = `<table role="presentation" width="100%" cellpadding="0" cellspacing="8" style="margin:6px 0 10px;">
    <tr>
      ${statPill('Harcama', input.spend, input.spendChangePct)}
      ${statPill('Gelir', input.revenue, input.revenueChangePct)}
      ${statPill('ROAS', input.roas, input.roasChangePct)}
    </tr>
  </table>`;

  const actions = input.actions.length
    ? `<div style="margin:14px 0 4px;color:#8a828f;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Önerilen aksiyonlar</div>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${input.actions
         .map(
           (a, i) =>
             `<tr><td style="padding:8px 0;color:#c9c2cf;font-size:14px;line-height:1.5;"><span style="color:#bea042;font-weight:700;">${i + 1}.</span> ${escapeHtml(a)}</td></tr>`,
         )
         .join('')}</table>`
    : '';

  return {
    subject: `Haftalık özet · ${input.tenantName}`,
    html: baseEmail({
      previewText: 'Bu haftanın performans özeti ve önerilen aksiyonlar.',
      heading: 'Haftalık performans özeti',
      paragraphs: [input.narrative],
      extraHtml: stats + actions,
      ctaLabel: 'Panoyu aç',
      ctaUrl: input.dashboardUrl,
      footerNote: 'Bu haftalık özeti Madmonos çalışma alanının üyesi olduğun için aldın.',
    }),
  };
}

export function boardReportEmail(input: {
  tenantName: string;
  executiveSummary: string;
  kpis: Array<{ label: string; value: string }>;
  recommendations: string[];
  reportUrl: string;
}): { subject: string; html: string } {
  // Two KPIs per row.
  const rows: string[] = [];
  for (let i = 0; i < input.kpis.length; i += 2) {
    rows.push(`<tr>${input.kpis
      .slice(i, i + 2)
      .map(
        (k) =>
          `<td style="padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;">
            <div style="color:#8a828f;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(k.label)}</div>
            <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(k.value)}</div>
          </td>`,
      )
      .join('')}</tr>`);
  }
  const stats = `<table role="presentation" width="100%" cellpadding="0" cellspacing="8" style="margin:6px 0 12px;">${rows.join('')}</table>`;

  const recs = input.recommendations.length
    ? `<div style="margin:14px 0 4px;color:#8a828f;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Önerilen aksiyonlar</div>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${input.recommendations
         .map(
           (a, i) =>
             `<tr><td style="padding:8px 0;color:#c9c2cf;font-size:14px;line-height:1.5;"><span style="color:#bea042;font-weight:700;">${i + 1}.</span> ${escapeHtml(a)}</td></tr>`,
         )
         .join('')}</table>`
    : '';

  return {
    subject: `Yönetim Kurulu Raporu · ${input.tenantName}`,
    html: baseEmail({
      previewText: 'Performans & strateji özeti ve önerilen aksiyonlar.',
      heading: 'Yönetim Kurulu Raporu',
      paragraphs: [input.executiveSummary],
      extraHtml: stats + recs,
      ctaLabel: 'Tam raporu aç',
      ctaUrl: input.reportUrl,
      footerNote: 'Bu raporu Madmonos çalışma alanının bir üyesi paylaştı.',
    }),
  };
}

export function agencyCreativeEventEmail(input: {
  tenantName: string;
  postTitle: string;
  kind: 'revision' | 'approved';
  byName?: string;
  reviewUrl: string;
}): { subject: string; html: string } {
  const isRevision = input.kind === 'revision';
  const who = input.byName ? ` (${input.byName})` : '';
  return {
    subject: isRevision
      ? `Revizyon istendi: “${input.postTitle}” · ${input.tenantName}`
      : `Onaylandı: “${input.postTitle}” · ${input.tenantName}`,
    html: baseEmail({
      previewText: `${input.tenantName} çalışma alanında bir kreatif ${isRevision ? 'revizyon bekliyor' : 'onaylandı'}.`,
      heading: isRevision ? 'Yeni revizyon talebi' : 'Kreatif onaylandı',
      paragraphs: [
        isRevision
          ? `${input.tenantName} müşterisi${who} “${input.postTitle}” içeriği için revizyon istedi.`
          : `${input.tenantName} müşterisi${who} “${input.postTitle}” içeriğini onayladı.`,
        isRevision
          ? 'Revizyon notlarını inceleyip güncellenmiş kreatifi yükleyebilirsin.'
          : 'İçerik yayına/takvime hazır.',
      ],
      ctaLabel: isRevision ? 'Revizyonu incele' : 'Kreatifi gör',
      ctaUrl: input.reviewUrl,
      footerNote: 'Bu bildirimi Madmonos ajans ekibi olarak aldın.',
    }),
  };
}

export function anomalyAlertEmail(input: {
  tenantName: string;
  title: string;
  body: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `⚠️ ${input.title} · ${input.tenantName}`,
    html: baseEmail({
      previewText: input.body,
      heading: input.title,
      paragraphs: [input.body],
      ctaLabel: 'Performansı incele',
      ctaUrl: input.dashboardUrl,
      footerNote: 'Bu uyarıyı hesabında dikkat gerektiren bir değişiklik tespit edildiği için aldın.',
    }),
  };
}

export function creativeReviewEmail(input: {
  postTitle: string;
  tenantName: string;
  reviewUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `İnceleme bekliyor: “${input.postTitle}”`,
    html: baseEmail({
      previewText: `${input.tenantName} için yeni bir kreatif onayını bekliyor.`,
      heading: 'Yeni kreatif inceleme bekliyor',
      paragraphs: [
        `${input.tenantName} çalışma alanına yeni bir kreatif yüklendi ve onayını bekliyor.`,
        `“${input.postTitle}” içeriğini inceleyip onaylayabilir veya revizyon isteyebilirsin.`,
      ],
      ctaLabel: 'Kreatifi incele',
      ctaUrl: input.reviewUrl,
      footerNote: 'Bu bildirimi bir Madmonos çalışma alanının üyesi olduğun için aldın.',
    }),
  };
}
