BEGIN;
-- Preserve existing organisation-wide access explicitly; new memberships default deny.
ALTER TABLE organisation_memberships ADD COLUMN IF NOT EXISTS all_sites boolean;
UPDATE organisation_memberships SET all_sites=true WHERE all_sites IS NULL;
ALTER TABLE organisation_memberships ALTER COLUMN all_sites SET DEFAULT false;
ALTER TABLE organisation_memberships ALTER COLUMN all_sites SET NOT NULL;
CREATE TABLE IF NOT EXISTS membership_site_grants (
  organisation_id uuid NOT NULL,
  subject text NOT NULL,
  site_id uuid NOT NULL REFERENCES sites(id),
  PRIMARY KEY (organisation_id, subject, site_id),
  FOREIGN KEY (organisation_id, subject)
    REFERENCES organisation_memberships(organisation_id, subject) ON DELETE CASCADE
);
COMMIT;
