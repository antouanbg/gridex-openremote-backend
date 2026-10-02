BEGIN;

ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS request_scope text NOT NULL DEFAULT 'member'
  CHECK (request_scope IN ('member','organisation'));
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_state_check;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_state_check
  CHECK (state IN ('open','approved','rejected','cancelled'));
DROP INDEX IF EXISTS service_requests_one_open;
CREATE UNIQUE INDEX service_requests_one_open
  ON service_requests(organisation_id,subject,service_code) WHERE state='open' AND request_scope='member';
CREATE UNIQUE INDEX IF NOT EXISTS service_requests_one_organisation_open
  ON service_requests(organisation_id,service_code) WHERE state='open' AND request_scope='organisation';
ALTER TABLE service_request_events DROP CONSTRAINT IF EXISTS service_request_events_action_check;
ALTER TABLE service_request_events ADD CONSTRAINT service_request_events_action_check
  CHECK (action IN ('requested','platform_approved','organisation_approved','rejected','cancelled'));

CREATE TABLE IF NOT EXISTS service_notifications (
  id uuid PRIMARY KEY,
  event_key text NOT NULL,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  service_code text NOT NULL REFERENCES service_catalog(code),
  kind text NOT NULL CHECK (kind IN ('organisation_requested','organisation_cancelled',
    'member_requested','organisation_granted','organisation_revoked','member_granted',
    'member_revoked','request_rejected')),
  recipient_realm text NOT NULL,
  recipient_subject text NOT NULL,
  recipient_email text,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','sending','queued','delivered','failed','unknown')),
  message_id text,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_key,recipient_realm,recipient_subject)
);
CREATE INDEX IF NOT EXISTS service_notifications_pending ON service_notifications(available_at)
  WHERE state='pending';

COMMIT;
