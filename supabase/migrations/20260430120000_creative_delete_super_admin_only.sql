-- Creative Hub: only platform super_admin may DELETE creative_assets (UI + server action).
-- Replaces prior policy that allowed tenant users with creative.approve.

drop policy if exists "creative_assets_delete" on public.creative_assets;

create policy "creative_assets_delete" on public.creative_assets
  for delete
  using (public.auth_is_super_admin());
