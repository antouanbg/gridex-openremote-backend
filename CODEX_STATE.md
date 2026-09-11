# Current task

Implement the VPN-only ROCK Pi Edge health ingestion chain.

# Completed

- Added a canonical 160-field PostgreSQL/OpenRemote/Edge/read-only ownership matrix for all ten sections.
- Added comprehensive required, range, enum, cross-field, topology and secret validators.
- Extended the allow-listed OpenRemote mapping for operational PV, battery, grid, forecast, strategy and load/EV fields.
- Kept economics, access policy, vendor protocol details and secrets outside OpenRemote.
- Documented the matrix and validation behaviour in English and Bulgarian.
- Restricted API currency preferences to EUR.
- Published draft PR #5, stacked on `feat/openremote-config-outbox`.
- Added MQTT topic/payload validation and PostgreSQL persistence for the
  latest Edge health record.
- Added the opt-in `gridex-edge-health-worker`, OpenRemote Site Asset
  projection, and an `edge` object in `/api/v1/sites/{siteId}/snapshot`.
- Added only placeholder MQTT settings and bilingual pipeline documentation.

# Remaining

- Review and merge configuration PR #3, worker PR #4, then this stacked PR.
- Validate the Compose profile and migrations on the Windows 11 Docker host.
- Configure real OpenRemote Asset bindings during commissioning.
- Review, push and open the Edge-health draft PR; deploy it only after the
  private MQTT listener and Site Router policy are commissioned.

# Modified files

- `README.md`
- `contracts/configuration-field-ownership.yaml`
- `contracts/gridex-api-v1.openapi.yaml`
- `docs/configuration-field-ownership.md`
- `docs/configuration-management-plan.md`
- `services/gridex-api/src/configuration-centre.mjs`
- `services/gridex-api/src/configuration-projection.mjs`
- `services/gridex-api/test/configuration-completeness.test.mjs`
- `services/gridex-api/migrations/004_edge_gateway_health.sql`
- `services/gridex-api/src/edge-health*.mjs`
- `services/gridex-api/test/edge-health.test.mjs`
- `docker-compose.yml`, `.env.example`, `docs/architecture/EDGE_HEALTH_PIPELINE.md`

# Tests

- `npm test` — 22/22 pass (requires local loopback permission for HTTP tests).
- `npm run check` — pass.
- YAML parse — 10 sections and 160 fields.
- Editable OpenRemote matrix attributes versus projection — no missing mappings.
- Edge-health implementation: `npm test` — 24/24 pass; `npm run check` — pass.

# Known issues

- The worker remains intentionally disabled unless the `configuration-worker` profile is enabled.
- No real OpenRemote or electrical equipment was modified.
- The Edge-health worker is intentionally disabled unless the `edge-health`
  Compose profile is enabled and it has private MQTT credentials.

# Next action

Review, commit and open the Edge-health draft PR stacked on the configuration
completeness branch; then commission the private MQTT route in a separate task.

# Last updated

2026-09-11
