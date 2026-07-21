-- Per-tenant reporting currency.
--
-- Money was previously rendered with a hardcoded "$" / en-US formatting, so a
-- Turkish workspace saw "$1,234" for what is actually ₺1.234. Storing the
-- currency on the tenant lets every surface (dashboard, reports, PDFs, emails)
-- format amounts correctly.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TRY';

COMMENT ON COLUMN public.tenants.currency IS
  'ISO-4217 code used to format all monetary values for this tenant (e.g. TRY, USD, EUR).';
