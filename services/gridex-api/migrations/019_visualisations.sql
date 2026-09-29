BEGIN;

ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS requestable boolean NOT NULL DEFAULT false;
UPDATE service_catalog SET requestable=true WHERE code='day_ahead';
INSERT INTO service_catalog(code,description,prerequisites,requestable) VALUES
  ('visualisations','GrideX visualisations via protected Grafana', '["verified_identity","active_organisation","site_access"]'::jsonb,true),
  ('analysis','Analysis (coming soon)','[]'::jsonb,false),
  ('meteorology','Meteorology (coming soon)','[]'::jsonb,false),
  ('forecasting','Forecasting (coming soon)','[]'::jsonb,false)
ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description,
  prerequisites=EXCLUDED.prerequisites, requestable=EXCLUDED.requestable;

CREATE TABLE IF NOT EXISTS grafana_launch_sessions (
  ticket_hash text PRIMARY KEY,
  subject text NOT NULL,
  realm text NOT NULL,
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  session_hash text UNIQUE,
  session_expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS grafana_launch_sessions_active_idx
  ON grafana_launch_sessions(subject,realm,session_expires_at);

COMMIT;
