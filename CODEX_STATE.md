# Current task

Implement a secure ENTSO-E A44 day-ahead price import foundation for the
data-services worker without storing the upstream token in Git.

## Completed

- Added the Python 3.12 `services/data-services` package skeleton.
- Added ENTSO-E A44 XML parsing, Open-Meteo request client, PV model and
  REST-only OpenRemote client foundations.
- Added TimescaleDB SQL bootstrap/init scripts, Compose service and environment
  placeholders without secrets or site configuration.
- Added the provisioning schema and data-service asset contract documentation.
- Replaced the obsolete direct ESP32-to-OpenRemote MQTTS path with the ROCK Pi
  MQTT bridge and backend-ingestion path in the integration documentation.
- Added a Docker-secret-first ENTSO-E token loader, authenticated A44 fetch
  client, idempotent PostgreSQL upsert and manual CLI operation.
- Removed the obsolete public MQTT `8883` Compose port; private telemetry uses
  the Site Router VPN path.
- Added `HANDOFF.md` to record every unimplemented backend data-services and
  commissioning milestone with dependencies, acceptance evidence and an exact
  next action.
- Added `AGENTS.md` with the mandatory HANDOFF/CODEX_STATE update policy for
  every future backend task.
- Recorded the unimplemented dedicated GrideX PostgreSQL/Timescale Compose
  service as an explicit HANDOFF item; only its SQL schema foundation exists.
- Required every HANDOFF to state its exact GitHub repository below the title.
- Fixed the market CLI parser and verified a live read-only ENTSO-E A44 import
  through `gridex-data`: 288 normalised 15-minute points were fetched without
  database persistence or token output.

## Remaining

- Implement asset discovery, scheduling and OpenRemote output-attribute
  creation for the data-services worker.
- Add further fixtures and the full test suite required by the handoff.
- Validate against the target Python 3.12, Ruff, MyPy, Pytest and Docker Compose.

## Tests

- A44 MockTransport and CLI-parser tests pass (3/3) in an isolated temporary
  environment.
- A live read-only A44 HTTPS/CLI test returned HTTP 200 and 288 normalised
  points; the temporary token file and response were removed immediately.
- Python source compiles in that environment; Compose YAML parses successfully.
- Docker Compose runtime validation is pending because Docker is unavailable locally.

## Known issues

- This is an implementation foundation, not a completed deployable worker yet.

## Next action

Read `HANDOFF.md`, then implement asset discovery and scheduled A44 refresh.
Validate the Compose runtime on the Windows 11 backend before opening a pull
request.
