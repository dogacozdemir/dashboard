-- Add image_metadata JSONB column to revisions table.
-- Stores structured image revision info: type, area description, reference URLs.

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS image_metadata JSONB;

COMMENT ON COLUMN public.revisions.image_metadata IS
  'Optional structured metadata for image revisions: { revisionType, area, references: [{url, description}] }';
