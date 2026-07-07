-- Creative INSERT RLS: tenant users scoped by tenant_id + permissions; super_admin may insert any tenant row.
-- Idempotent recreate — fixes drift if an older migration omitted auth_is_super_admin() on INSERT.

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

drop policy if exists creative_assets_insert on public.creative_assets;

create policy creative_assets_insert on public.creative_assets
  for insert with check (
    (
      tenant_id in (select u.tenant_id from public.users u where u.id = auth.uid())
      and public.auth_has_permission('creative.upload')
    )
    or public.auth_is_super_admin()
  );
