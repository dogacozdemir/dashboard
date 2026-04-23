import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { auth } from '@/lib/auth/config';
import { fetchMessages, markAllRead } from '@/features/chat/actions/chatActions';
import { ChatInterface } from '@/features/chat/components/ChatInterface';
import { MessageSquare } from 'lucide-react';
import type { SessionUser } from '@/types/user';

export default async function ChatPage() {
  const { companyId, tenant } = await requireTenantContext();
  const session = await auth();
  const user    = session?.user as SessionUser | undefined;

  const messages = await fetchMessages(companyId);
  await markAllRead(companyId);

  const currentUserName = user?.name ?? user?.email ?? 'You';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass glow-inset rounded-2xl p-5 border border-indigo-500/10 bg-gradient-to-r from-indigo-500/5 to-transparent">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/80">Chat</h2>
              <p className="text-xs text-white/40 mt-0.5">Team workspace for {tenant.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat window */}
      <div className="glass glow-inset rounded-2xl border border-white/[0.06] overflow-hidden">
        <ChatInterface
          companyId={companyId}
          initialMessages={messages}
          currentUserName={currentUserName}
        />
      </div>
    </div>
  );
}
