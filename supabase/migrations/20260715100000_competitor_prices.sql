-- Price tracking for competitors.
--
-- Change detection already flagged when a competitor's page moved, but prices —
-- the thing agencies care about most — were only mentioned incidentally in the
-- AI diff. Storing the detected prices per snapshot turns that into a real
-- price history and lets a price move drive its own, louder alert.

alter table public.competitor_snapshots
  add column if not exists prices jsonb not null default '[]'::jsonb;

comment on column public.competitor_snapshots.prices is
  'Currency-tagged prices detected on the page at capture time: [{amount, currency}]. Diffed against the prior snapshot to surface price moves.';
