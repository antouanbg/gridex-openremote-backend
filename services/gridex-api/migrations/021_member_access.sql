BEGIN;

-- Older invitations retain their existing identity; names are required only
-- for newly created invitations after the matching API rollout.
ALTER TABLE organisation_invitations
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

COMMIT;
