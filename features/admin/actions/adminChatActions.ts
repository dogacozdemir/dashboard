'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/auth/tenant-guard';
import { getPremiumAdminActionError } from '@/lib/copy/premium-copy';
import {
  CHAT_NOTIFICATION_TYPES,
  MADMONOS_SUPPORT_SENDER,
  isMadmonosSupportSender,
} from '@/features/chat/constants';
import type { ChatMessage } from '@/features/chat/types';

export type AdminChatTenantSummary = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastSenderName: string | null;
  /** Tenant sent the last message — awaiting Madmonos Support reply. */
  needsSupport: boolean;
};

function mapRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: (row.user_id as string | null) ?? null,
    senderName: row.sender_name as string,
    message: row.message as string,
    type: row.type as ChatMessage['type'],
    isRead: row.is_read as boolean,
    createdAt: row.created_at as string,
  };
}

function summarizeTenants(
  tenants: Array<{ id: string; slug: string; name: string; is_active: boolean }>,
  latestByTenant: Map<
    string,
    { created_at: string; message: string; sender_name: string; type: string }
  >,
): AdminChatTenantSummary[] {
  return tenants
    .map((t) => {
      const last = latestByTenant.get(t.id);
      const lastSender = last?.sender_name ?? null;
      const needsSupport =
        !!last &&
        last.type === 'message' &&
        !!lastSender &&
        !isMadmonosSupportSender(lastSender);

      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        isActive: t.is_active,
        lastMessageAt: last?.created_at ?? null,
        lastMessagePreview: last?.message ?? null,
        lastSenderName: lastSender,
        needsSupport,
      };
    })
    .sort((a, b) => {
      if (a.needsSupport !== b.needsSupport) return a.needsSupport ? -1 : 1;
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });
}

/** Tenant sidebar for Admin Chat Hub — active tenants + chat metadata. */
export async function fetchAdminChatTenants(): Promise<AdminChatTenantSummary[]> {
  await requireAdminSession();

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    admin = null;
  }

  const supabase = admin ?? (await createSupabaseServerClient());

  const { data: tenants, error: tenantsErr } = await supabase
    .from('tenants')
    .select('id, slug, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (tenantsErr || !tenants?.length) {
    if (tenantsErr) console.error('[fetchAdminChatTenants]', tenantsErr.message);
    return [];
  }

  const tenantIds = tenants.map((t) => t.id as string);

  const { data: recentRows, error: recentErr } = await supabase
    .from('notifications')
    .select('tenant_id, sender_name, message, created_at, type')
    .in('tenant_id', tenantIds)
    .in('type', [...CHAT_NOTIFICATION_TYPES])
    .order('created_at', { ascending: false })
    .limit(Math.min(tenantIds.length * 3, 600));

  if (recentErr) console.error('[fetchAdminChatTenants/recent]', recentErr.message);

  const latestByTenant = new Map<
    string,
    { created_at: string; message: string; sender_name: string; type: string }
  >();
  for (const row of recentRows ?? []) {
    const tid = row.tenant_id as string;
    if (!latestByTenant.has(tid)) {
      latestByTenant.set(tid, {
        created_at: row.created_at as string,
        message: row.message as string,
        sender_name: row.sender_name as string,
        type: row.type as string,
      });
    }
  }

  return summarizeTenants(
    tenants as Array<{ id: string; slug: string; name: string; is_active: boolean }>,
    latestByTenant,
  );
}

/** Full chat history for one tenant (Admin Support view). */
export async function fetchAdminTenantMessages(tenantId: string): Promise<ChatMessage[]> {
  await requireAdminSession();

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    admin = null;
  }

  const supabase = admin ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from('notifications')
    .select('id, tenant_id, user_id, sender_name, message, type, is_read, created_at')
    .eq('tenant_id', tenantId)
    .in('type', [...CHAT_NOTIFICATION_TYPES])
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[fetchAdminTenantMessages]', error.message);
    return [];
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

/** Inject an official Madmonos Support reply into the tenant chat thread. */
export async function sendAdminSupportMessage(
  tenantId: string,
  message: string,
): Promise<{ success: boolean; error?: string; message?: ChatMessage }> {
  await requireAdminSession();

  const trimmed = message.trim();
  if (!trimmed) {
    return { success: false, error: 'EMPTY_MESSAGE' };
  }

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    admin = null;
  }

  const supabase = admin ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      tenant_id: tenantId,
      user_id: null,
      sender_name: MADMONOS_SUPPORT_SENDER,
      message: trimmed,
      type: 'message',
      category: 'operational',
      is_read: false,
    })
    .select('id, tenant_id, user_id, sender_name, message, type, is_read, created_at')
    .single();

  if (error) {
    console.error('[sendAdminSupportMessage]', error.message);
    return { success: false, error: await getPremiumAdminActionError() };
  }

  return { success: true, message: mapRow(data as Record<string, unknown>) };
}
