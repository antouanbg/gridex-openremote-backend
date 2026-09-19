BEGIN;
CREATE TABLE IF NOT EXISTS device_heartbeats (
  gateway_id uuid PRIMARY KEY REFERENCES gateways(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_gateway_id uuid NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  last_successful_contact_at timestamptz,
  online boolean NOT NULL,
  heartbeat integer CHECK (heartbeat BETWEEN 0 AND 65535)
);
CREATE INDEX IF NOT EXISTS device_heartbeats_site ON device_heartbeats(site_id);
COMMIT;
