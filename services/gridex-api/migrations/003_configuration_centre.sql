BEGIN;

ALTER TABLE sites ADD COLUMN IF NOT EXISTS site_code text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'BG';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS longitude double precision;
CREATE UNIQUE INDEX IF NOT EXISTS sites_organisation_code_idx
  ON sites(organisation_id, site_code) WHERE deleted_at IS NULL AND site_code IS NOT NULL;

ALTER TABLE site_configurations DROP CONSTRAINT IF EXISTS site_configurations_section_check;
ALTER TABLE site_configurations DROP CONSTRAINT IF EXISTS site_configurations_status_check;
UPDATE site_configurations SET status='applied' WHERE status='active';
ALTER TABLE site_configurations
  ADD CONSTRAINT site_configurations_section_check CHECK (section IN (
    'site','pv','battery_pcs','metering_grid','market_tariffs','forecast',
    'strategy','loads_ev','edge_devices','notifications_access',
    'battery-asset','tariff','grid','evse','notifications','trader-schedule','balancing'));
ALTER TABLE site_configurations
  ADD CONSTRAINT site_configurations_status_check CHECK (status IN (
    'draft','validating','invalid','validated','simulating','ready','activating',
    'applied','rejected','superseded'));
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS base_revision integer NOT NULL DEFAULT 0;
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS validation jsonb NOT NULL DEFAULT '{"valid":false,"errors":[],"warnings":[]}'::jsonb;
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS simulation_result jsonb;
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS openremote_sync_state text NOT NULL DEFAULT 'not_requested';
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS openremote_applied_revision integer;
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS openremote_event_id text;
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS last_sync_error text;
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE site_configurations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS pv_arrays (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  configuration_id uuid NOT NULL REFERENCES site_configurations(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  orientation_profile text NOT NULL CHECK (orientation_profile IN ('south','east_west','east','west','mixed','custom')),
  mounting_type text NOT NULL CHECK (mounting_type IN ('rooftop','ground','carport','facade','floating')),
  tracking_type text NOT NULL CHECK (tracking_type IN ('fixed','single_axis','dual_axis')),
  module_layout text CHECK (module_layout IN ('1P','2P')),
  dc_kwp numeric(12,3) NOT NULL CHECK (dc_kwp > 0),
  tilt_deg numeric(6,2) NOT NULL CHECK (tilt_deg BETWEEN 0 AND 90),
  azimuth_deg numeric(6,2) NOT NULL CHECK (azimuth_deg >= 0 AND azimuth_deg < 360),
  east_share_pct numeric(5,2) CHECK (east_share_pct BETWEEN 0 AND 100),
  west_share_pct numeric(5,2) CHECK (west_share_pct BETWEEN 0 AND 100),
  performance_ratio numeric(5,4) NOT NULL CHECK (performance_ratio > 0 AND performance_ratio <= 1),
  temperature_coefficient_pct_per_c numeric(6,4),
  shading_loss_pct numeric(5,2) CHECK (shading_loss_pct BETWEEN 0 AND 100),
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  inverter_device_id uuid NOT NULL REFERENCES devices(id),
  openremote_asset_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pv_tracker_layout_required CHECK (tracking_type = 'fixed' OR module_layout IS NOT NULL),
  CONSTRAINT pv_east_west_split_valid CHECK (
    orientation_profile <> 'east_west' OR
    (east_share_pct IS NOT NULL AND west_share_pct IS NOT NULL AND east_share_pct + west_share_pct = 100))
);
CREATE INDEX IF NOT EXISTS pv_arrays_site_configuration_idx ON pv_arrays(site_id, configuration_id);

CREATE TABLE IF NOT EXISTS configuration_openremote_bindings (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  section text NOT NULL,
  local_resource_type text NOT NULL,
  local_resource_id text NOT NULL,
  openremote_asset_id text NOT NULL,
  attribute_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, section, local_resource_type, local_resource_id),
  UNIQUE(openremote_asset_id)
);

CREATE TABLE IF NOT EXISTS configuration_outbox (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  configuration_id uuid NOT NULL REFERENCES site_configurations(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('apply','rollback')),
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','applied','failed','dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS configuration_outbox_pending_idx ON configuration_outbox(status, available_at);

COMMIT;
