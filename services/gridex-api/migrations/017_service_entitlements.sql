BEGIN;

CREATE TABLE IF NOT EXISTS service_catalog (
  code text PRIMARY KEY,
  description text NOT NULL,
  prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO service_catalog(code, description, prerequisites)
VALUES ('day_ahead', 'ENTSO-E day-ahead market data', '["verified_identity", "active_organisation"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS organisation_services (
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  service_code text NOT NULL REFERENCES service_catalog(code),
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, service_code)
);

CREATE TABLE IF NOT EXISTS member_services (
  organisation_id uuid NOT NULL,
  service_code text NOT NULL,
  subject text NOT NULL,
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, service_code, subject),
  FOREIGN KEY (organisation_id, service_code)
    REFERENCES organisation_services(organisation_id, service_code) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, subject)
    REFERENCES organisation_memberships(organisation_id, subject) ON DELETE CASCADE
);

COMMIT;
