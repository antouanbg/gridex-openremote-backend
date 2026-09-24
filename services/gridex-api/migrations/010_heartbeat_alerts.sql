BEGIN;
CREATE TABLE IF NOT EXISTS heartbeat_alerts (
  gateway_id uuid PRIMARY KEY REFERENCES gateways(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('healthy','offline')),
  opened_at timestamptz,
  recovered_at timestamptz,
  notification_state text NOT NULL DEFAULT 'none'
    CHECK (notification_state IN ('none','pending','attempted','queued','unknown')),
  mailgun_message_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS heartbeat_alerts_site ON heartbeat_alerts(site_id);
COMMIT;
