-- Imperial Growth Engine: Meta publishing accounts, external crawl vectors, GSC URL inspections

-- ─── Meta Content Publishing (decoupled from ad_accounts) ───────────────────
create table if not exists public.meta_publishing_accounts (
  id                            uuid primary key default gen_random_uuid(),
  tenant_id                     uuid not null references public.tenants(id) on delete cascade,
  facebook_page_id              text,
  instagram_business_account_id text,
  page_access_token             text,
  token_iv                      text,
  updated_at                    timestamptz not null default now(),
  unique (tenant_id)
);

create index if not exists idx_meta_publishing_tenant
  on public.meta_publishing_accounts (tenant_id);

alter table public.meta_publishing_accounts enable row level security;

create policy "meta_publishing_select_tenant" on public.meta_publishing_accounts
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );

create policy "meta_publishing_insert" on public.meta_publishing_accounts
  for insert with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );

create policy "meta_publishing_update" on public.meta_publishing_accounts
  for update using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );

create policy "meta_publishing_super_admin_all" on public.meta_publishing_accounts
  for all using (public.auth_is_super_admin())
  with check (public.auth_is_super_admin());

comment on table public.meta_publishing_accounts is
  'Facebook Page + Instagram Business account tokens for Content Publishing API (separate from ad_accounts).';

-- ─── DeepMarka: crawled external knowledge (competitor / client URLs) ─────────
create table if not exists public.external_knowledge_chunks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  source_url   text not null,
  source_domain text not null,
  chunk_index  int not null,
  content      text not null,
  embedding    vector(1536) not null,
  crawled_at   timestamptz not null default now(),
  unique (tenant_id, source_url, chunk_index)
);

create index if not exists idx_external_chunks_tenant
  on public.external_knowledge_chunks (tenant_id);

create index if not exists idx_external_chunks_url
  on public.external_knowledge_chunks (tenant_id, source_url);

create index if not exists idx_external_chunks_embedding
  on public.external_knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.external_knowledge_chunks enable row level security;

create policy "external_knowledge_chunks_tenant_isolation"
  on public.external_knowledge_chunks
  for all
  using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );

create or replace function public.match_external_knowledge_chunks(
  query_embedding vector(1536),
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

grant execute on function public.match_external_knowledge_chunks(vector, uuid, int)
  to authenticated, service_role;

-- ─── GSC URL Inspection cache ───────────────────────────────────────────────
create table if not exists public.gsc_url_inspections (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  page_url        text not null,
  verdict         text,
  coverage_state  text,
  indexing_state  text,
  last_crawl_time timestamptz,
  inspected_at    timestamptz not null default now(),
  unique (tenant_id, page_url)
);

create index if not exists idx_gsc_inspections_tenant
  on public.gsc_url_inspections (tenant_id, inspected_at desc);

alter table public.gsc_url_inspections enable row level security;

create policy "gsc_url_inspections_tenant_isolation" on public.gsc_url_inspections
  for all using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
  );

comment on table public.gsc_url_inspections is
  'Cached Google Search Console URL Inspection API results for indexing health matrix.';
