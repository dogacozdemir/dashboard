-- Instagram credentials are discovered from the Meta token at read time, but the
-- table only had SELECT + INSERT policies, so the discovered account could never
-- be refreshed — and publishing, which reads this table exclusively, always saw
-- an empty row.

drop policy if exists "meta_publishing_update" on public.meta_publishing_accounts;

create policy "meta_publishing_update" on public.meta_publishing_accounts
  for update using (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  )
  with check (
    tenant_id in (select tenant_id from public.users where id = auth.uid())
    and public.auth_has_permission('integrations.manage')
  );
