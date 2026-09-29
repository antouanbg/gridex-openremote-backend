BEGIN;

-- The service grant and country/zone grant are separate, both default off.
-- Revoking day_ahead removes all organisation zone grants.
CREATE TABLE IF NOT EXISTS organisation_market_zones (
  organisation_id uuid NOT NULL,
  service_code text NOT NULL DEFAULT 'day_ahead' CHECK (service_code = 'day_ahead'),
  country text NOT NULL,
  zone text NOT NULL,
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, service_code, zone),
  FOREIGN KEY (organisation_id, service_code)
    REFERENCES organisation_services(organisation_id, service_code) ON DELETE CASCADE
);

COMMIT;
