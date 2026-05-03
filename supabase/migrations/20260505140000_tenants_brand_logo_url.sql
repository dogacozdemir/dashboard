-- White-label: canonical primary logo URL (synced from Brand Vault "Primary Logo").
alter table public.tenants
  add column if not exists brand_logo_url text;

comment on column public.tenants.brand_logo_url is
  'Public URL of tenant primary logo for shell white-label; null = default Madmonos mark.';

-- Allow tenant users with brand.upload (typically tenant_admin) to update their tenant row for branding.
-- super_admin already covered by tenant_super_admin_all.
create policy "tenants_update_brand_identity" on public.tenants
  for update
  using (
    id in (select u.tenant_id from public.users u where u.id = auth.uid())
    and public.auth_has_permission('brand.upload')
  )
  with check (
    id in (select u.tenant_id from public.users u where u.id = auth.uid())
    and public.auth_has_permission('brand.upload')
  );
