BEGIN;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS access_revision integer NOT NULL DEFAULT 0;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS access_valid_after bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS organisation_access_operations (
 id uuid PRIMARY KEY, organisation_id uuid NOT NULL REFERENCES organisations(id),
 revision integer NOT NULL, target text NOT NULL CHECK(target IN ('active','suspended')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','applied')),
 actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 mail_state text NOT NULL DEFAULT 'pending' CHECK(mail_state IN ('pending','sending','unknown','queued','delivered','failed','not_required')),
 recipient text, message_id text, checked_at timestamptz,
 UNIQUE(organisation_id,revision)
);
COMMIT;
