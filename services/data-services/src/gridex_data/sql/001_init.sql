CREATE TABLE IF NOT EXISTS dam_price (
  delivery_start timestamptz NOT NULL, zone_eic text NOT NULL, source text NOT NULL,
  resolution_min smallint NOT NULL, price_eur_mwh numeric(10,2) NOT NULL,
  document_mrid text, fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (delivery_start, zone_eic, source));
CREATE TABLE IF NOT EXISTS weather_forecast (
  run_at timestamptz NOT NULL, valid_at timestamptz NOT NULL, site_key text NOT NULL,
  model text NOT NULL, variable text NOT NULL, value double precision,
  PRIMARY KEY (site_key, variable, valid_at, run_at));
CREATE TABLE IF NOT EXISTS pv_forecast (
  run_at timestamptz NOT NULL, valid_at timestamptz NOT NULL, site_key text NOT NULL,
  array_name text NOT NULL, gti_w_m2 double precision, p_ac_kw double precision,
  PRIMARY KEY (site_key, array_name, valid_at, run_at));
CREATE TABLE IF NOT EXISTS fetch_log (
  id bigserial PRIMARY KEY, worker text NOT NULL, realm text, asset_id text, key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL, points int,
  http_status int, message text);
CREATE TABLE IF NOT EXISTS push_log (
  id bigserial PRIMARY KEY, worker text NOT NULL, realm text NOT NULL, asset_id text NOT NULL,
  attribute text NOT NULL, pushed_at timestamptz NOT NULL DEFAULT now(), points int NOT NULL,
  status text NOT NULL, message text);
