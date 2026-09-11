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

## Remaining

- Implement asset discovery, scheduling and OpenRemote output-attribute
  creation for the data-services worker.
- Add further fixtures and the full test suite required by the handoff.
- Validate against the target Python 3.12, Ruff, MyPy, Pytest and Docker Compose.

## Tests

- A44 MockTransport tests pass (2/2) in an isolated temporary environment.
- Python source compiles in that environment; Compose YAML parses successfully.
- Docker Compose runtime validation is pending because Docker is unavailable locally.

## Known issues

- This is an implementation foundation, not a completed deployable worker yet.

## Next action

Implement asset discovery and scheduled A44 refresh, then validate the Compose
runtime on the Windows 11 backend before opening a pull request.
