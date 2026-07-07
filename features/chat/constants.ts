/** Official Madmonos Support identity in tenant chat threads. */
export const MADMONOS_SUPPORT_SENDER = 'Madmonos Support';

export const CHAT_NOTIFICATION_TYPES = ['message', 'system', 'alert', 'approval'] as const;

export function isMadmonosSupportSender(senderName: string): boolean {
  return senderName.trim().toLowerCase() === MADMONOS_SUPPORT_SENDER.toLowerCase();
}
