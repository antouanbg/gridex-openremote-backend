-- Projection only: assets MUST already exist and be verified through OpenRemote API.
CREATE TABLE IF NOT EXISTS gateway_openremote_bindings (
  gateway_id uuid PRIMARY KEY REFERENCES gateways(id),
  openremote_asset_id text NOT NULL UNIQUE,
  verified_at timestamptz NOT NULL DEFAULT now()
);
