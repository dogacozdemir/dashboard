'use server';

import { auth } from '@/lib/auth/config';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateCreativePostStatus } from '@/features/creative-studio/actions/fetchAssets';
import { syncSEO } from '@/features/oauth/actions/syncPlatformData';
import type { SessionUser } from '@/types/user';

/**
 * MonoAI never mutates on its own. It *proposes* an action; the user confirms it
 * in the chat UI, and only then does the mutation run — with the same permission
 * checks the equivalent button would enforce.
 */
export type ProposedActionKind = 'approve_creative' | 'request_revision' | 'sync_data';

export interface ProposedAction {
  /** Stable id so the UI can track which card was confirmed. */
  id: string;
  kind: ProposedActionKind;
  /** Button label, already localised. */
  label: string;
  /** One line explaining exactly what will happen. */
  description: string;
  /** Target row id, when the action addresses a specific record. */
  targetId?: string;
}

const APPROVE_RE =
  /\b(onayla|onaylar\s*mısın|approve|onaylayabilir)\b/i;
const REVISION_RE =
  /\b(revize\s*(iste|talep)|revizyon\s*iste|request\s+(a\s+)?revision|düzeltme\s*iste)\b/i;
const SYNC_RE =
  /\b(senkron(ize)?\s*(et|la)?|verileri\s*(güncelle|yenile)|sync\s+(data|now)|refresh\s+data)\b/i;

/** Quoted or bare title fragment the user referred to, if any. */
function extractTitleHint(message: string): string | null {
  const quoted = message.match(/["“”'']([^"“”'']{3,80})["“”'']/);
  if (quoted) return quoted[1].trim();
  return null;
}

/**
 * Inspects the user's message and returns actions worth offering. Read-only:
 * resolves targets and filters by permission, but changes nothing.
 */
export async function proposeActionsForMessage(
  companyId: string,
  userMessage: string,
): Promise<ProposedAction[]> {
  const session = await auth();
  if (!session?.user) return [];

  const validatedId = await requireTenantAction(companyId);
  const user = session.user as SessionUser;
  const locale = user.locale === 'en' ? 'en' : 'tr';

  const wantsApprove = APPROVE_RE.test(userMessage);
  const wantsRevision = REVISION_RE.test(userMessage);
  const wantsSync = SYNC_RE.test(userMessage);
  if (!wantsApprove && !wantsRevision && !wantsSync) return [];

  const actions: ProposedAction[] = [];

  if ((wantsApprove || wantsRevision) && sessionHasPermission(user, 'creative.approve')) {
    const supabase = await createSupabaseServerClient();
    const hint = extractTitleHint(userMessage);

    let query = supabase
      .from('creative_posts')
      .select('id, title')
      .eq('tenant_id', validatedId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(hint ? 3 : 1);

    if (hint) query = query.ilike('title', `%${hint}%`);

    const { data: posts } = await query;

    for (const p of (posts ?? []) as Array<{ id: string; title: string }>) {
      if (wantsApprove) {
        actions.push({
          id: `approve-${p.id}`,
          kind: 'approve_creative',
          targetId: p.id,
          label: locale === 'en' ? 'Approve' : 'Onayla',
          description:
            locale === 'en'
              ? `Mark "${p.title}" as approved.`
              : `"${p.title}" içeriğini onaylanmış olarak işaretle.`,
        });
      }
      if (wantsRevision) {
        actions.push({
          id: `revision-${p.id}`,
          kind: 'request_revision',
          targetId: p.id,
          label: locale === 'en' ? 'Request revision' : 'Revize iste',
          description:
            locale === 'en'
              ? `Move "${p.title}" back to revision.`
              : `"${p.title}" içeriğini revize durumuna al.`,
        });
      }
    }
  }

  if (wantsSync && sessionHasPermission(user, 'integrations.manage')) {
    actions.push({
      id: 'sync-data',
      kind: 'sync_data',
      label: locale === 'en' ? 'Sync now' : 'Şimdi senkronize et',
      description:
        locale === 'en'
          ? 'Pull the latest Search Console, GA4 and Core Web Vitals data.'
          : 'Search Console, GA4 ve Core Web Vitals verilerini yeniden çek.',
    });
  }

  return actions;
}

/**
 * Runs a previously proposed action after explicit user confirmation. Each
 * branch delegates to the same server action the equivalent UI button uses, so
 * permissions, tenant scoping and activity tracking stay identical.
 */
export async function executeProposedAction(
  companyId: string,
  kind: ProposedActionKind,
  targetId?: string,
): Promise<{ success: boolean; message: string }> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: 'Oturum bulunamadı.' };
  }

  const validatedId = await requireTenantAction(companyId);
  const locale = (session.user as SessionUser).locale === 'en' ? 'en' : 'tr';

  try {
    switch (kind) {
      case 'approve_creative':
      case 'request_revision': {
        if (!targetId) {
          return { success: false, message: locale === 'en' ? 'No target selected.' : 'Hedef seçilmedi.' };
        }
        const status = kind === 'approve_creative' ? 'approved' : 'revision';
        const res = await updateCreativePostStatus(targetId, status, validatedId);
        if (!res.success) {
          return { success: false, message: res.error ?? (locale === 'en' ? 'Action failed.' : 'İşlem başarısız.') };
        }
        return {
          success: true,
          message:
            kind === 'approve_creative'
              ? locale === 'en' ? 'Creative approved.' : 'Kreatif onaylandı.'
              : locale === 'en' ? 'Revision requested.' : 'Revize talebi oluşturuldu.',
        };
      }

      case 'sync_data': {
        const res = await syncSEO(validatedId);
        if (res.error) return { success: false, message: res.error };
        return {
          success: true,
          message: locale === 'en' ? 'Sync started — data will refresh shortly.' : 'Senkron başlatıldı — veriler kısa sürede güncellenecek.',
        };
      }

      default:
        return { success: false, message: locale === 'en' ? 'Unknown action.' : 'Bilinmeyen eylem.' };
    }
  } catch (e) {
    console.error('[executeProposedAction]', kind, e);
    return {
      success: false,
      message: locale === 'en' ? 'Action could not be completed.' : 'Eylem tamamlanamadı.',
    };
  }
}
