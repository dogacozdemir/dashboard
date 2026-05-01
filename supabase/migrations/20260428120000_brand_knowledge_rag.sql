-- ============================================================
-- Brand Vault RAG: pgvector + chunks + indexing metadata
-- ============================================================

create extension if not exists vector;

alter table public.brand_assets
  add column if not exists storage_key text;

alter table public.brand_assets
  add column if not exists indexing_status text not null default 'pending'
  check (indexing_status in ('pending', 'ready', 'failed', 'skipped'));

alter table public.brand_assets
  add column if not exists indexing_error text;

alter table public.brand_assets
  add column if not exists indexed_at timestamptz;

create index if not exists idx_brand_assets_indexing
  on public.brand_assets (tenant_id, indexing_status);

create table if not exists public.brand_knowledge_chunks (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  brand_asset_id   uuid not null references public.brand_assets(id) on delete cascade,
  chunk_index      int not null,
  content          text not null,
  embedding        vector(1536) not null,
  created_at       timestamptz not null default now(),
  unique (brand_asset_id, chunk_index)
);

alter table public.brand_knowledge_chunks enable row level security;

create policy "brand_knowledge_chunks_tenant_isolation"
  on public.brand_knowledge_chunks
  for all
  using (
    tenant_id in (
      select tenant_id from public.users where id = auth.uid()
    )
  );

create index if not exists idx_brand_chunks_tenant
  on public.brand_knowledge_chunks (tenant_id);

create index if not exists idx_brand_chunks_asset
  on public.brand_knowledge_chunks (brand_asset_id);

create index if not exists idx_brand_chunks_embedding
  on public.brand_knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_brand_knowledge_chunks(
  query_embedding vector(1536),
  p_tenant_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  brand_asset_id uuid,
  chunk_index int,
  content text,
  similarity double precision,
  asset_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.tenant_id = p_tenant_id
  ) then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    c.id,
    c.brand_asset_id,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::double precision as similarity,
    a.name as asset_name
  from public.brand_knowledge_chunks c
  inner join public.brand_assets a on a.id = c.brand_asset_id
  where c.tenant_id = p_tenant_id
  order by c.embedding <=> query_embedding
  limit least(coalesce(match_count, 8), 24);
end;
$$;

grant execute on function public.match_brand_knowledge_chunks(vector, uuid, int)
  to authenticated;

grant execute on function public.match_brand_knowledge_chunks(vector, uuid, int)
  to service_role;
