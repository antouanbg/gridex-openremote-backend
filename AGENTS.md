# GrideX OpenRemote backend — Working rules

## Architecture and security

Owner decision, 2026-09-14: Windows experiments are stopped. The active backend
development/staging target is Linux ARM64 under macOS using Colima and Docker
Engine. Follow `docs/MAC_LINUX_HANDOFF.md`. Earlier Windows 11 production plans
are historical context, not an instruction to resume Windows deployment. Final
production commissioning remains pending. Keep the Site Router VPN and ownership
boundaries below unchanged. Do not resume PR #10–#13's Windows/cloud execution
paths without a new owner request.

Решение на собственика от 2026-09-14: Windows експериментите спират. Активната
backend development/staging среда е Linux ARM64 под macOS с Colima и Docker
Engine. Следвай `docs/MAC_LINUX_HANDOFF.md`. Предходните Windows 11 production
планове са исторически контекст, не указание за продължаване на Windows deployment.
Production commissioning предстои; запазват се Site Router VPN и границите на
отговорност. Windows/cloud изпълнението от PR #10–#13 не продължава без ново искане.

The central backend hosts Docker services, GrideX API, PostgreSQL,
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
