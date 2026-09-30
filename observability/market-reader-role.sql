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
  market_interval_prices, market_interval_price_revisions,
  market_fetch_status FROM gridex_grafana_market_ro;

-- The Grafana data source must not be able to query another country's rows,
-- even if a Viewer constructs an arbitrary data-source query.
CREATE OR REPLACE VIEW grafana_bg_hourly_prices WITH (security_barrier = true) AS
  SELECT start_utc, price_eur_mwh FROM market_hourly_prices
  WHERE country = 'BG' AND zone = 'BG';
-- Native 15-minute prices take precedence. Older hourly-only history remains
-- visible until it is backfilled from the provider, without fabricating 15m data.
CREATE OR REPLACE VIEW grafana_bg_interval_prices WITH (security_barrier = true) AS
  SELECT start_utc, price_eur_mwh FROM market_interval_prices
  WHERE country = 'BG' AND zone = 'BG'
  UNION ALL
  SELECT h.start_utc, h.price_eur_mwh FROM market_hourly_prices h
  WHERE h.country = 'BG' AND h.zone = 'BG'
    AND NOT EXISTS (
      SELECT 1 FROM market_interval_prices i
      WHERE i.country = 'BG' AND i.zone = 'BG'
        AND i.start_utc >= h.start_utc
        AND i.start_utc < h.start_utc + interval '1 hour'
    );
CREATE OR REPLACE VIEW grafana_bg_fetch_status WITH (security_barrier = true) AS
  SELECT last_success_at FROM market_fetch_status WHERE zone = 'BG';
GRANT SELECT ON grafana_bg_hourly_prices, grafana_bg_interval_prices,
  grafana_bg_fetch_status
  TO gridex_grafana_market_ro;
