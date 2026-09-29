BEGIN;
ALTER TABLE organisation_onboarding_invitations ADD COLUMN IF NOT EXISTS recipient_resend_used_at timestamptz;
ALTER TABLE organisation_invitations ADD COLUMN IF NOT EXISTS recipient_resend_used_at timestamptz;
CREATE TABLE IF NOT EXISTS user_login_activity (
  realm text NOT NULL,
  subject text NOT NULL,
  last_authenticated_at timestamptz NOT NULL,
  PRIMARY KEY (realm, subject)
);
COMMIT;
