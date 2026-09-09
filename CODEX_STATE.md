# CODEX_STATE.md

## Current task

No active task.

## Completed

- Added `AGENTS.md` with the canonical v4 Site Router WireGuard topology,
  safety boundaries, data ownership and repository rules.
- Added English and Bulgarian Site Router VPN topology diagrams.
- Added the selectable forecast-model API contract:
  `lightgbm_v1` and `anguelov_ibex_milp_v1`.

## Remaining

- Implement the forecasting/optimisation worker: IBEX adapters, weather,
  PV/load forecasts, 96 × 15-minute schedule and no-sale-at-loss enforcement.
- Persist schedule/economics results and publish only validated changes to
  Strategy/Control Assets after simulation and commissioning.
- Connect the portal selector to the authenticated API and strategy drafts.

## Modified files

- `AGENTS.md`
- `CODEX_STATE.md`
- `README.md`
- `docs/diagrams/site-vpn-topology-en.mmd`
- `docs/diagrams/site-vpn-topology-bg.mmd`
- `services/gridex-api/src/forecast-models.mjs`
- `services/gridex-api/src/strategy-config.mjs`
- `services/gridex-api/src/app.mjs`

## Tests

- Backend API: 12/12 tests passed for the forecast-model contract.
- Documentation: diff check and secret scan passed; no real VPN keys, IP ranges,
  credentials or deployment domains were added.

## Known issues

- Forecasting worker and external IBEX/weather connectors are not implemented.
- No production access, real site inventory or credentials are stored here.

## Next action

Read `AGENTS.md` and inspect the repository before starting the next task.

## Last updated

2026-09-09
