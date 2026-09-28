BEGIN;

-- Workflow state only. OpenRemote remains the authoritative asset registry.
CREATE TABLE IF NOT EXISTS inventory_provisioning_intents (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  site_id uuid REFERENCES sites(id),
  kind text NOT NULL CHECK (kind IN ('site','gateway')),
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  resource_id uuid NOT NULL UNIQUE,
  openremote_asset_id text,
  state text NOT NULL CHECK (state IN ('pending','failed','complete')),
  attempt_started_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, kind, idempotency_key)
);

COMMIT;
