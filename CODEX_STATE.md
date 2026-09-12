# Current task

Prepare the PostgreSQL/OpenRemote configuration lifecycle Pull Request.

# Completed

- Added the ten canonical configuration scopes.
- Added PostgreSQL revision, validation, simulation, binding and outbox storage.
- Added normalised PV array fields and conditional database constraints.
- Added API validation and draft/validate/simulate/activate endpoints.
- Added a bilingual ownership and implementation plan.
- Added tests proving that a saved draft does not write OpenRemote directly.

# Remaining

- Implement the outbox worker and concrete OpenRemote attribute mapper in a separate runtime Pull Request.
- Apply the migration to a disposable PostgreSQL instance before production deployment.

# Modified files

- `services/gridex-api/migrations/003_configuration_centre.sql`
- `services/gridex-api/src/configuration-centre.mjs`
- `services/gridex-api/src/app.mjs`
- `services/gridex-api/src/repository.mjs`
- `services/gridex-api/test/server.test.mjs`
- `contracts/gridex-api-v1.openapi.yaml`
- `docs/configuration-management-plan.md`
- `README.md`

# Tests

- `npm test` — 12/12 pass.
- `npm run check` — pass.

# Known issues

- Activation is queued only; the worker intentionally remains disabled until its own reviewed PR.

# Next action

Commit, push and open a Pull Request to `main`.

# Last updated

2026-09-10
