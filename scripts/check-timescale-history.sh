#!/usr/bin/env bash
# Read-only audit; never outputs device identities, values or credentials.
set -euo pipefail
context="${1:-colima-gridex}"
container="${2:-gridex-mac-postgresql-1}"
docker --context "$context" exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d openremote -c "
SELECT extname, extversion FROM pg_extension WHERE extname IN ('timescaledb','timescaledb_toolkit');
SELECT hypertable_schema, hypertable_name FROM timescaledb_information.hypertables;
SELECT count(*) AS historical_measurements FROM openremote.asset_datapoint;
SELECT proc_name, config FROM timescaledb_information.jobs
 WHERE proc_name IN ('policy_compression','policy_retention');
"
