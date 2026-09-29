BEGIN;

CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  subject text NOT NULL,
  realm text NOT NULL,
  email text NOT NULL,
  service_code text NOT NULL REFERENCES service_catalog(code),
  country text,
  zone text,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((service_code='day_ahead' AND country='BG' AND zone='BG') OR
         (service_code<>'day_ahead' AND country IS NULL AND zone IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS service_requests_one_open
  ON service_requests(organisation_id,subject,service_code) WHERE state='open';
CREATE INDEX IF NOT EXISTS service_requests_org_created
  ON service_requests(organisation_id,created_at DESC);

CREATE TABLE IF NOT EXISTS service_request_events (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  actor_subject text NOT NULL,
  action text NOT NULL CHECK (action IN ('requested','platform_approved','organisation_approved','rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_request_events_request
  ON service_request_events(request_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS service_request_events_approval_once
  ON service_request_events(request_id,action)
  WHERE action IN ('platform_approved','organisation_approved');

COMMIT;
