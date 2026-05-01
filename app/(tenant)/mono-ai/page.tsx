import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { fetchAiHistory } from '@/features/ai-chat/actions/aiChatActions';
import { AiChatInterface } from '@/features/ai-chat/components/AiChatInterface';
import type { SessionUser } from '@/types/user';

export default async function MonoAiPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!sessionHasPermission(user, 'ai.mono_chat')) redirect('/unauthorized');

  const { companyId, tenant } = await requireTenantContext();
  const aiHistory = await fetchAiHistory(companyId);

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
        <AiChatInterface
          companyId={companyId}
          tenantName={tenant.name}
          initialHistory={aiHistory}
        />
      </div>
    </div>
  );
}
