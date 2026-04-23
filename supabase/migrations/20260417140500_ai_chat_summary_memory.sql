-- ============================================================
-- ai_chat_summaries: long-term memory layer for Mono AI
-- ============================================================
create table if not exists public.ai_chat_summaries (
  tenant_id       uuid primary key references public.tenants(id) on delete cascade,
  summary_text    text not null,
  source_message_count int not null default 0,
  updated_at      timestamptz not null default now()
);

alter table public.ai_chat_summaries enable row level security;

create policy "ai_chat_summaries_tenant_isolation" on public.ai_chat_summaries
  for all using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_ai_chat_summaries_updated_at
  on public.ai_chat_summaries (updated_at desc);

