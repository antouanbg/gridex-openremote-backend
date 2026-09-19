-- Metadata only; does not enable physical device writes.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE site_configurations DROP CONSTRAINT site_configurations_section_check;
ALTER TABLE site_configurations ADD CONSTRAINT site_configurations_section_check
  CHECK (section IN ('battery-asset','tariff','forecast','grid','evse','notifications','trader-schedule','balancing','device-setup','device-import'));
COMMIT;
