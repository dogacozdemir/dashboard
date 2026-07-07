-- Allow super_admin to list all users in Global User Directory (session-scoped reads).
-- Mutations (invite/revoke) still require SUPABASE_SERVICE_ROLE_KEY via auth.admin.

create policy "users_super_admin_select_all" on public.users
  for select
  to authenticated
  using (public.auth_is_super_admin());

comment on policy "users_super_admin_select_all" on public.users is
  'God Mode user directory reads without service role when logged in as super_admin.';
