BEGIN;

CREATE TABLE IF NOT EXISTS edge_gateway_health (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  gateway_id text NOT NULL CHECK (gateway_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL CHECK (state IN ('starting','ready','degraded','safe_mode','offline')),
  pcs_heartbeat_ok boolean NOT NULL,
  control_ready boolean NOT NULL,
  safe_mode boolean NOT NULL,
  northbound_ready boolean NOT NULL,
  node_online_count integer NOT NULL CHECK (node_online_count >= 0),
  node_total integer NOT NULL CHECK (node_total >= 0 AND node_total >= node_online_count),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (site_id, gateway_id)
);

CREATE INDEX IF NOT EXISTS edge_gateway_health_received_idx ON edge_gateway_health(site_id, received_at DESC);

COMMIT;
