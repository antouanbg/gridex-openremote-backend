BEGIN;

CREATE TABLE IF NOT EXISTS organisations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  openremote_realm text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organisation_memberships (
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  subject text NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer','operator','energy_manager','integrator','administrator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, subject)
);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  name text NOT NULL,
  timezone text NOT NULL,
  market_code text,
  status text NOT NULL DEFAULT 'commissioning' CHECK (status IN ('commissioning','active','offline','archived')),
  openremote_realm text NOT NULL,
  openremote_site_asset_id text UNIQUE,
  openremote_strategy_asset_id text UNIQUE,
  openremote_control_asset_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS hardware_configurations (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL CHECK (status IN ('draft','validated','active','superseded','rejected')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE(site_id, revision)
);

CREATE TABLE IF NOT EXISTS gateways (
  id uuid PRIMARY KEY,
  hardware_configuration_id uuid NOT NULL REFERENCES hardware_configurations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id),
  name text NOT NULL,
  hardware_model text NOT NULL,
  role text NOT NULL CHECK (role IN ('controller','device-node')),
  management_network jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gateway_ports (
  id uuid PRIMARY KEY,
  gateway_id uuid NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  name text NOT NULL,
  transport text NOT NULL CHECK (transport IN ('ethernet','modbus-tcp','rs485','can','ocpp','mqtt')),
  channel text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gateway_id, name)
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  parent_device_id uuid REFERENCES devices(id),
  gateway_id uuid REFERENCES gateways(id),
  gateway_port_id uuid REFERENCES gateway_ports(id),
  device_type text NOT NULL CHECK (device_type IN ('inverter','battery','meter','evse')),
  name text NOT NULL,
  manufacturer text NOT NULL,
  model text NOT NULL,
  serial_number text,
  driver_key text NOT NULL,
  protocol text NOT NULL,
  connection jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','configured','online','offline','fault','provisioning_failed','archived')),
  openremote_asset_id text UNIQUE,
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_device_per_gateway_port
  ON devices(gateway_port_id) WHERE deleted_at IS NULL AND gateway_port_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_device_per_gateway
  ON devices(gateway_id) WHERE deleted_at IS NULL AND gateway_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS telemetry_points (
  id uuid PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES devices(id),
  canonical_name text NOT NULL,
  openremote_attribute_name text NOT NULL,
  value_type text NOT NULL,
  unit text,
  polarity text,
  writable boolean NOT NULL DEFAULT false,
  history_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(device_id, canonical_name)
);

CREATE TABLE IF NOT EXISTS openremote_asset_bindings (
  device_id uuid PRIMARY KEY REFERENCES devices(id),
  openremote_asset_id text NOT NULL UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_configurations (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  section text NOT NULL CHECK (section IN ('battery-asset','tariff','forecast','grid','evse','notifications','trader-schedule','balancing')),
  revision integer NOT NULL,
  configuration jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','active','superseded')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, section, revision)
);

CREATE TABLE IF NOT EXISTS tariffs (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  site_id uuid REFERENCES sites(id),
  name text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('BGN','EUR')),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  structure jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  revision integer NOT NULL,
  lifecycle text NOT NULL CHECK (lifecycle IN ('draft','validating','invalid','ready','activating','active','rejected','superseded')),
  configuration jsonb NOT NULL,
  simulation_id uuid,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  UNIQUE(site_id, revision)
);

CREATE TABLE IF NOT EXISTS strategy_drafts (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  base_revision integer NOT NULL CHECK (base_revision >= 0),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  lifecycle text NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft','validating','invalid','ready','activating','rejected')),
  configuration jsonb NOT NULL,
  validation jsonb NOT NULL DEFAULT '{"valid":false,"errors":[],"warnings":[]}',
  simulation_id uuid,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategy_simulations (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  draft_id uuid NOT NULL REFERENCES strategy_drafts(id),
  draft_revision integer NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','completed','failed')),
  horizon_from timestamptz NOT NULL,
  horizon_to timestamptz NOT NULL,
  input_versions jsonb NOT NULL DEFAULT '{}',
  projected jsonb,
  violations jsonb NOT NULL DEFAULT '[]',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE strategy_drafts DROP CONSTRAINT IF EXISTS strategy_drafts_simulation_id_fkey;
ALTER TABLE strategy_drafts ADD CONSTRAINT strategy_drafts_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES strategy_simulations(id);

CREATE TABLE IF NOT EXISTS battery_energy_ledger_15m (
  site_id uuid NOT NULL REFERENCES sites(id),
  battery_device_id uuid NOT NULL REFERENCES devices(id),
  interval_start timestamptz NOT NULL,
  pv_to_battery_kwh numeric NOT NULL DEFAULT 0 CHECK (pv_to_battery_kwh >= 0),
  grid_to_battery_kwh numeric NOT NULL DEFAULT 0 CHECK (grid_to_battery_kwh >= 0),
  battery_to_load_kwh numeric NOT NULL DEFAULT 0 CHECK (battery_to_load_kwh >= 0),
  battery_to_grid_kwh numeric NOT NULL DEFAULT 0 CHECK (battery_to_grid_kwh >= 0),
  charge_kwh numeric NOT NULL DEFAULT 0 CHECK (charge_kwh >= 0),
  discharge_kwh numeric NOT NULL DEFAULT 0 CHECK (discharge_kwh >= 0),
  degradation_cost numeric NOT NULL DEFAULT 0,
  depreciation_cost numeric NOT NULL DEFAULT 0,
  conversion_loss_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL CHECK (currency IN ('BGN','EUR')),
  quality text NOT NULL CHECK (quality IN ('GOOD','STALE','INVALID')),
  calculation_version text NOT NULL,
  PRIMARY KEY(site_id, battery_device_id, interval_start)
);

CREATE TABLE IF NOT EXISTS economic_forecasts (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  horizon_start timestamptz NOT NULL,
  horizon_end timestamptz NOT NULL,
  model_version text NOT NULL,
  price_forecast_sources jsonb NOT NULL,
  weather_forecast_version text,
  pv_forecast_version text,
  load_forecast_version text,
  tariff_revision integer,
  battery_asset_revision integer,
  result jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS alarms (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  device_id uuid REFERENCES devices(id),
  openremote_alarm_id text,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  state text NOT NULL CHECK (state IN ('open','acknowledged','closed')),
  code text NOT NULL,
  title text NOT NULL,
  message text,
  opened_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by text,
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  site_id uuid REFERENCES sites(id),
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  state text NOT NULL CHECK (state IN ('open','investigating','resolved','closed')),
  owner_subject text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS incident_alarms (
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  alarm_id uuid NOT NULL REFERENCES alarms(id),
  PRIMARY KEY(incident_id, alarm_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  subject text NOT NULL,
  site_id uuid REFERENCES sites(id),
  channel text NOT NULL CHECK (channel IN ('push','email','sms','webhook')),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  payload jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('queued','sent','failed','read')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  read_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_preferences (
  subject text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  preferences jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  subject text NOT NULL,
  site_id uuid REFERENCES sites(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  result text NOT NULL,
  request_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_site_idx ON devices(site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS alarms_site_state_idx ON alarms(site_id, state, opened_at DESC);
CREATE INDEX IF NOT EXISTS audit_site_created_idx ON audit_events(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS battery_ledger_site_interval_idx ON battery_energy_ledger_15m(site_id, interval_start DESC);
CREATE INDEX IF NOT EXISTS economic_forecasts_site_created_idx ON economic_forecasts(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS strategy_drafts_site_updated_idx ON strategy_drafts(site_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS strategy_simulations_draft_created_idx ON strategy_simulations(draft_id, created_at DESC);

COMMIT;
