-- Migrate pgvector embeddings from OpenAI 1536-dim to local gte-small 384-dim.
-- Re-index Brand Vault assets and re-crawl external URLs after applying.

truncate table public.brand_knowledge_chunks;
truncate table public.external_knowledge_chunks;

alter table public.brand_knowledge_chunks
  drop column if exists embedding;

alter table public.brand_knowledge_chunks
  add column embedding vector(384) not null;

alter table public.external_knowledge_chunks
  drop column if exists embedding;

alter table public.external_knowledge_chunks
  add column embedding vector(384) not null;

drop index if exists idx_brand_chunks_embedding;
create index idx_brand_chunks_embedding
  on public.brand_knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

drop index if exists idx_external_chunks_embedding;
create index idx_external_chunks_embedding
  on public.external_knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_brand_knowledge_chunks(
  query_embedding vector(384),
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

create or replace function public.match_external_knowledge_chunks(
  query_embedding vector(384),
  p_tenant_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  source_url text,
  chunk_index int,
  content text,
  similarity double precision
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
    c.source_url,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::double precision as similarity
  from public.external_knowledge_chunks c
  where c.tenant_id = p_tenant_id
  order by c.embedding <=> query_embedding
  limit least(coalesce(match_count, 8), 24);
end;
$$;

grant execute on function public.match_brand_knowledge_chunks(vector, uuid, int)
  to authenticated, service_role;

grant execute on function public.match_external_knowledge_chunks(vector, uuid, int)
  to authenticated, service_role;

comment on column public.brand_knowledge_chunks.embedding is
  'Local gte-small (384) via @xenova/transformers — no OpenAI dependency.';
