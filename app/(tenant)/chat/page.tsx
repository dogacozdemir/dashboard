import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { auth } from '@/lib/auth/config';
import { fetchMessages, markAllRead } from '@/features/chat/actions/chatActions';
import { ChatInterface } from '@/features/chat/components/ChatInterface';
import type { SessionUser } from '@/types/user';
import { getTranslations } from 'next-intl/server';

export default async function ChatPage() {
  const { companyId, tenant } = await requireTenantContext();
  const session = await auth();
  const user    = session?.user as SessionUser | undefined;
  const tChat = await getTranslations('Features.Chat');

  const messages = await fetchMessages(companyId);
  await markAllRead(companyId);

  const currentUserName = user?.name ?? user?.email ?? tChat('fallbackYou');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="madmonos-chat-shell relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.10]"
        style={{
          background: 'rgba(29, 15, 29, 0.45)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.12), inset 1px 0 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <ChatInterface
          companyId={companyId}
          tenantName={tenant.name}
          initialMessages={messages}
          currentUserName={currentUserName}
        />
      </div>
    </div>
  );
}
