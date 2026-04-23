-- Add video_metadata JSONB column to revisions table.
-- Stores structured video revision info: type, time range, reference URLs.

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS video_metadata JSONB;

COMMENT ON COLUMN public.revisions.video_metadata IS
  'Optional structured metadata for video revisions: { revisionType, startTime, endTime, references: [{url, description}] }';
