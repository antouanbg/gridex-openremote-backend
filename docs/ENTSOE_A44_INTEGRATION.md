# ENTSO-E day-ahead prices / Цени „ден напред“

Owner decision (2026-09-29): reuse `/market/` in the portal. Country and bidding
zone are explicit user choices; "service" means a market product, not a tariff.
Phase one exposes only `day_ahead` / ENTSO-E document `A44`.

## API contract

- `GET /api/v1/market/services`: authenticated catalogue of supported market
  products and bidding zones. Requires current `site:read` permission.
- `GET /api/v1/market/prices?country=BG&zone=BG&service=day_ahead&date=YYYY-MM-DD`:
  published intervals with UTC start/end, local-zone date/timezone, `EUR/MWh`,
  source document ID and fetch timestamp. Requires current `site:read`.
- `status=published` only when a full local day is continuous; otherwise
  `partial` or `not_published`. A missing publication never becomes a zero
  price. API errors are generic and never include the provider's token URL.
- The backend permits a bounded date range and caches each zone/date briefly
  with in-flight request coalescing. Cache is process-local; before multiple
  API replicas, move it to a shared store and rate-limit centrally.

## Provisioning / Провизиране

Obtain a personal ENTSO-E Transparency Platform API security token through
the provider's account process. Put it only in the existing **single private
backend `.env`** as `GRIDEX_ENTSOE_SECURITY_TOKEN`; never in Git, browser,
OpenRemote asset metadata, query output or chat. The Compose templates forward
that variable to `gridex-api`. If it is absent the endpoint returns 503 and
the live UI shows no demo values. The provider API is HTTPS-only and the token
is sent only upstream. There is no schema migration and no battery dispatch.

Rollout order: install token privately, deploy backend, verify anonymous 401,
wrong-role 403, catalogue, real A44 for Bulgaria and a DST/negative-price day,
then publish frontend and BG/EN Docusaurus. Verify desktop/mobile and mark the
public guide live only after real browser acceptance.

References (official):

- https://transparencyplatform.zendesk.com/hc/en-us/articles/15696677194644-Request-Endpoint
- https://transparencyplatform.zendesk.com/hc/en-us/articles/15885757676308-Area-List-with-Energy-Identification-Code-EIC
- https://transparencyplatform.zendesk.com/hc/en-us/articles/12783148966036-API-Rate-Limit-Part-1
