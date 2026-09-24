BEGIN;

-- A workflow intent, not a second active organisation registry. OpenRemote
-- remains authoritative for the realm; organisations is populated at acceptance.
CREATE TABLE IF NOT EXISTS organisation_onboarding_invitations (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL UNIQUE,
  realm text NOT NULL UNIQUE CHECK (realm ~ '^[a-z][a-z0-9-]{2,30}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
  email text NOT NULL,
  subject text,
  created_by text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'reserved','realm_ready','identity_ready','sent','activating',
    'provisioning_failed','delivery_failed','activation_failed','accepted','revoked'
  )),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  accepted_at timestamptz,
  last_error_code text
);

CREATE INDEX IF NOT EXISTS organisation_onboarding_subject_idx
  ON organisation_onboarding_invitations(subject, email)
  WHERE state IN ('sent','activating');

COMMIT;
