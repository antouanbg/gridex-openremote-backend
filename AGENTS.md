# GrideX OpenRemote backend — Working rules

## Architecture and security

Windows 10 Enterprise on HP Z800 is a temporary, isolated staging environment.
Windows 11 remains the planned production architecture. Staging must not connect
to or command physical devices; see docs/STAGING_STARTUP_PLAN.md for entry gates.

Windows 10 Enterprise на HP Z800 е временна изолирана staging среда.
Windows 11 остава планираната production архитектура. Staging не трябва да се
свързва с физически устройства или да ги управлява; условията за старт са в
docs/STAGING_STARTUP_PLAN.md.

The Windows 11 backend hosts Docker services, GrideX API, PostgreSQL,
OpenRemote, Keycloak and private MQTT ingestion. Each Site Router terminates
its own WireGuard peer; ROCK Pi and ESP nodes are behind the router. Browser
clients reach only GrideX API; OpenRemote owns live Assets and rules, while
Edge owns vendor protocols and safety. Never commit or log secrets, customer
inventory, real addresses or VPN ranges.

## Bilingual documentation — mandatory

For every user-facing, architecture, API-contract, security, operational or
deployment text:

1. English is canonical and Bulgarian is the matching section.
2. Change both language versions in the same commit whenever meaning changes.
3. Keep API fields, data paths, configuration defaults, units, safety gates and
   responsibility boundaries semantically identical.
4. Preserve project terminology: `Site = Обект`, `Edge gateway = Edge шлюз`,
   `self-consumption = собствено потребление`, and `Flexible loads = Управляеми
   товари`.
5. Do not translate identifiers, protocol names, Docker keys, API paths or
   product brands.

Before committing, compare the EN/BG sections and correct any mismatch rather
than leaving a stale translation.

## Task recovery

Read this file, `CODEX_STATE.md` and `HANDOFF.md` when present, then inspect
repository state. Every `HANDOFF.md` must identify its repository directly
under the title as `Repository / GitHub: <owner>/<repository>` and be updated
for every incomplete, untested, deployment-blocked or commissioning-blocked
item.
