import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchAiHistory } from '@/features/ai-chat/actions/aiChatActions';
import { AiChatInterface } from '@/features/ai-chat/components/AiChatInterface';
import { Brain } from 'lucide-react';

export default async function MonoAiPage() {
  const { companyId, tenant } = await requireTenantContext();
  const aiHistory = await fetchAiHistory(companyId);

  return (
    <div className="space-y-4">
      <div className="glass glow-inset rounded-2xl p-5 border border-indigo-500/10 bg-gradient-to-r from-indigo-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/80">Mono AI</h2>
            <p className="text-xs text-white/40 mt-0.5">
              monoAI v1 strategic assistant for {tenant.name}
            </p>
          </div>
        </div>
      </div>

      <div className="glass glow-inset rounded-2xl border border-white/[0.06] overflow-hidden">
        <AiChatInterface
          companyId={companyId}
          tenantName={tenant.name}
          initialHistory={aiHistory}
        />
      </div>
    </div>
  );
}

