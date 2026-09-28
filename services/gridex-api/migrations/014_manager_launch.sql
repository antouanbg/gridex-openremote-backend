CREATE TABLE IF NOT EXISTS manager_launch_sessions (
  ticket_hash text PRIMARY KEY,
  session_hash text UNIQUE,
  subject uuid NOT NULL,
  realm text NOT NULL,
  expires_at timestamptz NOT NULL,
  session_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manager_launch_sessions_session_lookup
  ON manager_launch_sessions(session_hash) WHERE session_hash IS NOT NULL;
