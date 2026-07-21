import { NotificationCenter } from '@/app/components/layout/NotificationCenter';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapRowToLuxNotification } from '@/features/notifications/lib/mapNotificationRow';
import type { LuxNotificationItem } from '@/features/notifications/types';

interface LayoutInitialNotificationsProps {
  companyId: string;
  enabled: boolean;
}

export async function LayoutInitialNotifications({
  companyId,
  enabled,
}: LayoutInitialNotificationsProps) {
  if (!enabled || !companyId) {
    return <NotificationCenter companyId={companyId} initialNotifs={[]} enabled={false} />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: notifRows } = await supabase
    .from('notifications')
    .select(
      'id, message, type, sender_name, is_read, created_at, category, action_url, action_label',
    )
    .eq('tenant_id', companyId)
    .order('created_at', { ascending: false })
    .limit(30);

  const initialNotifs: LuxNotificationItem[] = (notifRows ?? []).map((n) =>
    mapRowToLuxNotification({
      id: n.id,
      message: n.message,
      type: n.type,
      sender_name: n.sender_name,
      is_read: n.is_read,
      created_at: n.created_at,
      category: (n as { category?: string | null }).category,
      action_url: (n as { action_url?: string | null }).action_url,
      action_label: (n as { action_label?: string | null }).action_label,
    }),
  );

  return (
    <NotificationCenter companyId={companyId} initialNotifs={initialNotifs} enabled={enabled} />
  );
}
