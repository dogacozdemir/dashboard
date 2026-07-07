-- Revision resolution + edit tracking.
-- Adds the ability to mark a revision "resolved" and to track edits.
-- The existing `revisions_tenant_isolation` policy is `for all`, so tenant
-- members can already UPDATE these rows; author/permission enforcement lives
-- in the server actions (resolveRevision / editRevision / deleteRevision).

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz;

COMMENT ON COLUMN public.revisions.resolved_at IS
  'When a reviewer marked this revision resolved (null = open).';
COMMENT ON COLUMN public.revisions.resolved_by IS
  'auth.users id of the reviewer who resolved the revision.';
COMMENT ON COLUMN public.revisions.updated_at IS
  'Last time the revision text/metadata was edited by its author.';

CREATE INDEX IF NOT EXISTS idx_revisions_resolved_at
  ON public.revisions (resolved_at);
