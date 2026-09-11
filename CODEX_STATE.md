# Current task

Align backend data-path documentation and MQTT configuration to the VPN-only
Site Router topology before continuing the data-services worker.

## Completed

- Added the Python 3.12 `services/data-services` package skeleton.
- Added ENTSO-E A44 XML parsing, Open-Meteo request client, PV model and
  REST-only OpenRemote client foundations.
- Added TimescaleDB SQL bootstrap/init scripts, Compose service and environment
  placeholders without secrets or site configuration.
- Added the provisioning schema and data-service asset contract documentation.
- Replaced the obsolete direct ESP32-to-OpenRemote MQTTS path with the ROCK Pi
  MQTT bridge and backend-ingestion path in the integration documentation.

## Remaining

- Implement discovery, database persistence, scheduling, CLI subcommands and
  OpenRemote output-attribute creation.
- Add offline fixtures and the full test suite required by the handoff.
- Validate against Python 3.12, Ruff, MyPy, Pytest and Docker Compose.

## Tests

- Python source compiles using the available interpreter with temporary cache.
- Docker Compose validation is pending because Docker is unavailable locally.

## Known issues

- This is an implementation foundation, not a completed deployable worker yet.

## Next action

Commit and push the data-path documentation correction, then implement asset
discovery and persistence for the data-services worker.
