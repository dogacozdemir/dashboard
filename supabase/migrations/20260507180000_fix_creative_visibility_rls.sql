-- Creative visibility: tenant users see their tenant; super_admin sees and mutates all tenants.
-- Replaces narrow SELECT policies that failed when viewer tenant_id ≠ row tenant_id (e.g. impersonation / subdomain context).

-- ─── creative_posts ─────────────────────────────────────────────────────────
drop policy if exists creative_posts_select_tenant on public.creative_posts;

create policy creative_posts_select_tenant on public.creative_posts
  for select using (
    tenant_id in (select u.tenant_id from public.users u where u.id = auth.uid())
    or public.auth_is_super_admin()
  );

drop policy if exists creative_posts_insert on public.creative_posts;

create policy creative_posts_insert on public.creative_posts
  for insert with check (
    (
      tenant_id in (select u.tenant_id from public.users u where u.id = auth.uid())
      and (
        public.auth_has_permission('creative.upload')
        or public.auth_has_permission('creative.approve')
      )
    )
    or public.auth_is_super_admin()
  );

drop policy if exists creative_posts_update on public.creative_posts;

create policy creative_posts_update on public.creative_posts
  for update
  using (
    (
      tenant_id in (select u.tenant_id from public.users u where u.id = auth.uid())
      and (
        public.auth_has_permission('creative.approve')
        or public.auth_has_permission('creative.upload')
        or public.auth_has_permission('creative.comment')
      )
    )
    or public.auth_is_super_admin()
  )
  with check (
    public.auth_is_super_admin()
    or (
      tenant_id in (select u.tenant_id from public.users u where u.id = auth.uid())
      and (
        public.auth_has_permission('creative.approve')
        or public.auth_has_permission('creative.upload')
        or (
          public.auth_has_permission('creative.comment')
          and status is distinct from 'approved'
        )
      )
    )
  );

-- ─── creative_assets ────────────────────────────────────────────────────────
drop policy if exists creative_assets_select_tenant on public.creative_assets;

create policy creative_assets_select_tenant on public.creative_assets
  for select using (
    tenant_id in (select u.tenant_id from public.users u where u.id = auth.uid())
    or public.auth_is_super_admin()
  );

drop policy if exists creative_assets_insert on public.creative_assets;

create policy creative_assets_insert on public.creative_assets
  for insert with check (
    (
      tenant_id in (select u.tenant_id from public.users u where u.id = auth.uid())
      and public.auth_has_permission('creative.upload')
    )
    or public.auth_is_super_admin()
  );
