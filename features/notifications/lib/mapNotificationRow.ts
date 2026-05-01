import type { LuxNotificationItem, NotificationCategory, NotificationRecordType } from '../types';

/** Maps DB row to Lux item; safe if `category` column not yet migrated. */
export function mapRowToLuxNotification(n: {
  id: string;
  message: string;
  type: string;
  sender_name: string;
  is_read: boolean;
  created_at: string;
  category?: string | null;
  action_url?: string | null;
  action_label?: string | null;
}): LuxNotificationItem {
  const type = (['message', 'alert', 'approval', 'system'].includes(n.type)
    ? n.type
    : 'system') as NotificationRecordType;

  let category: NotificationCategory =
    n.category === 'ai_strategic' || n.category === 'operational' || n.category === 'system'
      ? n.category
      : type === 'system'
        ? 'system'
        : type === 'alert'
          ? 'ai_strategic'
          : 'operational';

  return {
    id: n.id,
    message: n.message,
    type,
    category,
    senderName: n.sender_name,
    isRead: n.is_read,
    createdAt: n.created_at,
    actionUrl: n.action_url ?? null,
    actionLabel: n.action_label ?? null,
  };
}
