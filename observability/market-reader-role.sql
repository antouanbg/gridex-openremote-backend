-- Run once against gridex_market as its owner before enabling Grafana.
-- This deliberately creates NOLOGIN: set a unique private password and
-- enable LOGIN only during the reviewed activation step.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gridex_grafana_market_ro') THEN
    CREATE ROLE gridex_grafana_market_ro NOLOGIN;
  END IF;
END $$;

GRANT CONNECT ON DATABASE gridex_market TO gridex_grafana_market_ro;
GRANT USAGE ON SCHEMA public TO gridex_grafana_market_ro;
GRANT SELECT ON market_hourly_prices, market_hourly_price_revisions,
  market_fetch_status TO gridex_grafana_market_ro;
