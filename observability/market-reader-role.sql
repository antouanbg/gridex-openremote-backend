-- Run against gridex_market as its owner before enabling the BG dashboard.
-- This creates NOLOGIN; set a unique private password and enable LOGIN only
-- during the reviewed activation step. Repeatable after a prior broad grant.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gridex_grafana_market_ro') THEN
    CREATE ROLE gridex_grafana_market_ro NOLOGIN;
  END IF;
END $$;

GRANT CONNECT ON DATABASE gridex_market TO gridex_grafana_market_ro;
GRANT USAGE ON SCHEMA public TO gridex_grafana_market_ro;
REVOKE SELECT ON market_hourly_prices, market_hourly_price_revisions,
  market_fetch_status FROM gridex_grafana_market_ro;

-- The Grafana data source must not be able to query another country's rows,
-- even if a Viewer constructs an arbitrary data-source query.
CREATE OR REPLACE VIEW grafana_bg_hourly_prices WITH (security_barrier = true) AS
  SELECT start_utc, price_eur_mwh FROM market_hourly_prices
  WHERE country = 'BG' AND zone = 'BG';
CREATE OR REPLACE VIEW grafana_bg_fetch_status WITH (security_barrier = true) AS
  SELECT last_success_at FROM market_fetch_status WHERE zone = 'BG';
GRANT SELECT ON grafana_bg_hourly_prices, grafana_bg_fetch_status
  TO gridex_grafana_market_ro;
