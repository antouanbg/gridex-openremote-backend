# ENTSO-E day-ahead prices / Цени „ден напред“

Owner decision (2026-09-29): reuse `/market/` in the portal. Country and bidding
zone are explicit user choices; "service" means a market product, not a tariff.
Phase one exposes only `day_ahead` / ENTSO-E document `A44`.

## API contract

- `GET /api/v1/market/services`: platform-administrator catalogue of supported
  market products and bidding zones.
- `GET /api/v1/market/prices?country=BG&zone=BG&service=day_ahead&date=YYYY-MM-DD`:
  platform-administrator-only historical hourly compatibility series in
  `EUR/MWh`; each row indicates the native source resolution and interval
  count. Native BG 15-minute points are retained separately for the guarded
  Grafana view, not exposed through this older direct API contract.
- `status=published` only when a full local day is continuous; otherwise
  `partial` or `not_published`. A missing publication never becomes a zero
  price. API errors are generic and never include the provider's token URL.
- The worker checks the next delivery day once per hour. One A44 request can
  return all 92/96/100 BG quarter-hour points; 15-minute market resolution
  does not require a request every 15 minutes. A current-day check after
  startup/local midnight recovers from outages. `partial` for tomorrow does
  not make today's already archived prices disappear.

## Provisioning / Провизиране

Obtain a personal ENTSO-E Transparency Platform API security token through
the provider's account process. Put it only in the existing **single private
backend `.env`** as `GRIDEX_ENTSOE_SECURITY_TOKEN`; never in Git, browser,
OpenRemote asset metadata, query output or chat. The Compose template forwards
that variable only to `gridex-market-worker`. If it is absent the worker does
not start and the live UI shows no demo values. The provider API is HTTPS-only
and the token is sent only upstream. The additive native-interval TimescaleDB
tables are created by the worker schema at startup; there is no battery dispatch.

Rollout order for native BG intervals: back up the market database, apply the
additive schema/restricted BG view, deploy only the market worker, verify 96
native points for a normal BG day plus existing hourly data, direct-table
denial for the Grafana reader and anonymous/wrong-role 401/403. Then publish
the frontend and BG/EN Docusaurus. Verify desktop/mobile and mark the public
guide live only after real browser acceptance.

References (official):

- https://transparencyplatform.zendesk.com/hc/en-us/articles/15696677194644-Request-Endpoint
- https://transparencyplatform.zendesk.com/hc/en-us/articles/15885757676308-Area-List-with-Energy-Identification-Code-EIC
- https://transparencyplatform.zendesk.com/hc/en-us/articles/12783148966036-API-Rate-Limit-Part-1
