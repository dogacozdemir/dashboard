export type NotificationCategory = 'ai_strategic' | 'operational' | 'system';

export type NotificationRecordType = 'message' | 'alert' | 'approval' | 'system';

export interface LuxNotificationItem {
  id: string;
  message: string;
  type: NotificationRecordType;
  category: NotificationCategory;
  senderName: string;
  isRead: boolean;
  createdAt: string;
  actionUrl: string | null;
  actionLabel: string | null;
}
