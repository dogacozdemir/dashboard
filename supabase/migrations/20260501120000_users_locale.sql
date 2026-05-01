-- User UI locale (cookie + profile); default Turkish for existing rows.
alter table public.users
  add column if not exists locale text not null default 'tr';

alter table public.users
  add constraint users_locale_check check (locale in ('tr', 'en'));

comment on column public.users.locale is 'Dashboard locale: tr | en (synced with madmonos.locale cookie).';
