-- Super Admin: inject support messages into any tenant chat thread (notifications table).

create policy "notifications_super_admin_insert" on public.notifications
  for insert
  to authenticated
  with check (public.auth_is_super_admin());

comment on policy "notifications_super_admin_insert" on public.notifications is
  'Allows God Mode support hub to post as Madmonos Support into tenant chat.';
