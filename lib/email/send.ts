import 'server-only';

/**
 * Minimal transactional email via the Resend HTTP API (no SDK dependency).
 *
 * Dormant by design: without RESEND_API_KEY + RESEND_FROM it no-ops and returns
 * `{ sent: false, skipped: true }`, so the app runs fine before email is configured
 * (same pattern as the PageSpeed integration).
 */

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text fallback; derived from a stripped html if omitted. */
  text?: string;
  replyTo?: string;
}

export type SendEmailResult =
  | { sent: true; id: string | null }
  | { sent: false; skipped: true }
  | { sent: false; error: string };

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM; // e.g. "Madmonos <noreply@madmonos.com>"
  if (!apiKey || !from) return { sent: false, skipped: true };

  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((e) => e.trim())
    .filter(Boolean);
  if (recipients.length === 0) return { sent: false, skipped: true };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text ?? stripHtml(input.html),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[email] resend', res.status, body.slice(0, 200));
      return { sent: false, error: `resend ${res.status}` };
    }
    const json = (await res.json()) as { id?: string };
    return { sent: true, id: json.id ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send failed';
    console.error('[email] send error', msg);
    return { sent: false, error: msg };
  }
}
