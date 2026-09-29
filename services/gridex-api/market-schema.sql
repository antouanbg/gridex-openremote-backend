-- Dedicated GrideX market TimescaleDB. No retention/drop policy: prices are permanent.
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS market_hourly_prices (
  start_utc timestamptz NOT NULL,
  zone text NOT NULL,
  country text NOT NULL,
  delivery_date date NOT NULL,
  price_eur_mwh numeric(16,6) NOT NULL,
  source_document_id text,
  source_resolution_minutes integer NOT NULL CHECK (source_resolution_minutes IN (15,60)),
  source_interval_count integer NOT NULL CHECK (source_interval_count IN (1,4)),
  fetched_at timestamptz NOT NULL,
  PRIMARY KEY (zone, start_utc)
);

SELECT create_hypertable('market_hourly_prices', 'start_utc', if_not_exists => TRUE);

-- Append-only distinct revisions preserve supplier corrections for later analysis.
CREATE TABLE IF NOT EXISTS market_hourly_price_revisions (
  start_utc timestamptz NOT NULL,
  zone text NOT NULL,
  country text NOT NULL,
  delivery_date date NOT NULL,
  price_eur_mwh numeric(16,6) NOT NULL,
  source_document_id text NOT NULL,
  source_resolution_minutes integer NOT NULL CHECK (source_resolution_minutes IN (15,60)),
  source_interval_count integer NOT NULL CHECK (source_interval_count IN (1,4)),
  first_seen_at timestamptz NOT NULL,
  PRIMARY KEY (zone,start_utc,source_document_id,price_eur_mwh)
);

SELECT create_hypertable('market_hourly_price_revisions', 'start_utc', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS market_fetch_status (
  zone text PRIMARY KEY,
  country text NOT NULL,
  last_attempt_at timestamptz NOT NULL,
  last_success_at timestamptz,
  latest_delivery_date date,
  status text NOT NULL CHECK (status IN ('published','not_published','partial','error')),
  error_code text
);
