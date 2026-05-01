'use server';

import { getPremiumActionError } from '@/lib/copy/premium-copy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { auth } from '@/lib/auth/config';
import type { ChatMessage, MessageType } from '../types';
import type { SessionUser } from '@/types/user';

export async function fetchMessages(companyId: string): Promise<ChatMessage[]> {
  const validatedId = await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, tenant_id, user_id, sender_name, message, type, is_read, created_at')
    .eq('tenant_id', validatedId)
    .in('type', ['message', 'system', 'alert', 'approval'])
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[fetchMessages]', error.message);
    return [];
  }

  return (data ?? []).map((m) => ({
    id:         m.id,
    tenantId:   m.tenant_id,
    userId:     m.user_id,
    senderName: m.sender_name,
    message:    m.message,
    type:       m.type as MessageType,
    isRead:     m.is_read,
    createdAt:  m.created_at,
  }));
}

export async function sendMessage(
  companyId: string,
  message: string,
  type: MessageType = 'message'
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: 'Unauthorized' };

  const user = session.user as SessionUser;
  await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const category =
    type === 'system' ? 'system' : type === 'alert' ? 'ai_strategic' : 'operational';

  const { error } = await supabase.from('notifications').insert({
    tenant_id:   companyId,
    user_id:     user.id,
    sender_name: user.name ?? user.email,
    message:     message.trim(),
    type,
    category,
    is_read:     false,
  });

  if (error) {
    console.error('[sendMessage]', error.message);
    return { success: false, error: await getPremiumActionError() };
  }
  return { success: true };
}

export async function markAllRead(companyId: string): Promise<void> {
  const validatedId = await requireTenantAction(companyId);
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('tenant_id', validatedId)
    .eq('is_read', false);
}
