-- Track byte size on creative slides for admin storage audit + S3 metrics.

alter table public.creative_assets
  add column if not exists file_size bigint;

comment on column public.creative_assets.file_size is
  'Object size in bytes at upload time (from presign contentLength).';

-- Super Admin: cross-tenant brand vault reads for storage audit page.
drop policy if exists brand_assets_select_tenant on public.brand_assets;

create policy brand_assets_select_tenant on public.brand_assets
  for select using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    or public.auth_is_super_admin()
  );
