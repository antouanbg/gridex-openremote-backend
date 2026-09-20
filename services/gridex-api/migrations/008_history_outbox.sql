BEGIN;
-- Durable transport buffer, not the long-term measurement store.
CREATE TABLE IF NOT EXISTS history_outbox (
  gateway_id uuid NOT NULL REFERENCES gateways(id),
  site_id uuid NOT NULL REFERENCES sites(id),
  asset_id text NOT NULL,
  metric text NOT NULL,
  observed_at timestamptz NOT NULL,
  value double precision NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY(asset_id,metric,observed_at)
);
CREATE INDEX IF NOT EXISTS history_outbox_pending ON history_outbox(observed_at) WHERE submitted_at IS NULL;
COMMIT;
