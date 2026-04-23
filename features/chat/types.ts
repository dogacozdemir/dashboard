export type MessageType = 'message' | 'alert' | 'approval' | 'system';

export interface ChatMessage {
  id: string;
  tenantId: string;
  userId: string | null;
  senderName: string;
  message: string;
  type: MessageType;
  isRead: boolean;
  createdAt: string;
}
