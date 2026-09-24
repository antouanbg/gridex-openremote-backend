BEGIN;
CREATE TABLE IF NOT EXISTS heartbeat_email_subscriptions (
  subject text PRIMARY KEY,
  email text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS heartbeat_alert_deliveries (
  gateway_id uuid NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL,
  subject text NOT NULL,
  email text NOT NULL,
  state text NOT NULL CHECK (state IN ('attempted','queued','unknown')),
  mailgun_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(gateway_id,opened_at,subject)
);
COMMIT;
