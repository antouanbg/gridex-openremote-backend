BEGIN;
CREATE TABLE IF NOT EXISTS organisation_invitations (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  email text NOT NULL,
  subject text NOT NULL,
  role text NOT NULL CHECK(role IN ('viewer','operator','energy_manager','integrator')),
  site_ids uuid[] NOT NULL,
  state text NOT NULL CHECK(state IN ('pending_delivery','sent','delivery_failed','accepted','revoked')),
  created_by text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS invitations_subject_idx ON organisation_invitations(subject);
COMMIT;
