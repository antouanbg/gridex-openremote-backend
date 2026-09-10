# Current task

Prepare the OpenRemote configuration outbox worker Pull Request.

# Completed

- Added leased PostgreSQL outbox claiming with per-site/section revision order.
- Added trusted binding resolution and allow-listed configuration projections.
- Protected command, heartbeat, telemetry and BMS-limit attributes from writes.
- Added OpenRemote read-back revision verification.
- Added retry, bounded backoff, dead-letter and atomic applied-state handling.
- Added a separate opt-in Docker Compose worker profile.
- Added English/Bulgarian operating and ownership documentation.

# Remaining

- Review and merge configuration PR #3 before this stacked PR.
- Validate the Compose profile and migrations on the Windows 11 Docker host.
- Configure real OpenRemote Asset bindings during commissioning.

# Modified files

- `.env.example`
- `docker-compose.yml`
- `README.md`
- `docs/configuration-outbox-worker.md`
- `services/gridex-api/migrations/003_configuration_centre.sql`
- `services/gridex-api/src/config.mjs`
- `services/gridex-api/src/configuration-projection.mjs`
- `services/gridex-api/src/configuration-worker-service.mjs`
- `services/gridex-api/src/configuration-worker.mjs`
- `services/gridex-api/src/repository.mjs`
- `services/gridex-api/test/configuration-worker.test.mjs`

# Tests

- `npm test` — 17/17 pass.
- `npm run check` — pass.
- Docker Compose validation unavailable locally because Docker CLI is not installed.

# Known issues

- The worker is intentionally disabled unless the `configuration-worker` profile is enabled.
- No real OpenRemote or electrical equipment was modified by these tests.

# Next action

Final diff/secret review, commit, push and open a stacked Pull Request.

# Last updated

2026-09-10
