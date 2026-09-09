# GrideX EMS: agent instructions

## Scope and source of truth

This repository contains the private-cloud GrideX backend: OpenRemote,
Keycloak, PostgreSQL, the GrideX API/BFF and architecture contracts. The portal
and Edge firmware are maintained in separate repositories.

Read `CODEX_STATE.md`, `README.md`, `docs/integration-flow.md` and the relevant
contract before changing code or documentation. Verify the actual repository
state; documents are not a substitute for code, tests or deployment review.

## Network architecture (v4)

- The central backend runs on Windows 11.
- Every physical Site has its own Site Router.
- WireGuard runs only on the Windows backend and each Site Router. Every Site
  has its own peer, key material and isolated VPN configuration.
- ROCK Pi E, OLIMEX ESP32 nodes and OT/BESS devices are behind the Site Router.
  They are **not** WireGuard peers and must not become VPN endpoints.
- CONTROL and TELEMETRY are separate site networks. The OT/BESS network is not
  directly routed to the backend.
- Backend-to-site Modbus and VPN-only MQTT use the Site Router tunnel. Public
  MQTT is forbidden; TCP 8883 may be bound only to the backend VPN interface.
- Site-to-site routing is forbidden by default. Do not add a route, bridge or
  service path that allows one Site to reach another Site.

## Safety and command ownership

- The browser never connects directly to OpenRemote Assets, MQTT or site
  devices. `gridex-api` validates identity and membership, normalises data and
  returns only authorised DTOs.
- A strategy writes desired configuration/power only to protected Strategy or
  Control Assets. It never writes vendor registers directly.
- ROCK Pi E remains the local command and safety authority: fresh BMS limits,
  SOC, PCS state/faults, heartbeat, software fuse and TTL are mandatory before
  device power can be applied.
- Missing or stale telemetry is `null` plus quality metadata, never a fabricated
  zero. Default to safe zero power on invalid or expired control input.
- Suntech SunStorage Pro 261 is the first confirmed integration. Preserve the
  confirmed sign, scale, heartbeat and atomic-read rules in its driver contract.

## Data, forecasting and economics

- OpenRemote owns live Assets, datapoints, rules and protocol Agents. GrideX
  PostgreSQL owns tenancy, configuration revisions, topology, asset bindings,
  tariffs and audit metadata.
- The forecast worker produces 96 15-minute intervals. It consumes two named
  price forecasts, weather/cloud cover/sunrise/sunset, PV/load forecasts and
  current technical limits.
- Keep direct PV export and battery-discharge export economically separate.
  Battery discharge must include source energy, conversion loss, degradation,
  enabled depreciation, fees, imbalance risk and configured minimum margin.
  The no-sale-at-loss policy is enforced before a schedule is activated.
- The published Anguelov IBEX MILP profile is a selectable optimisation model;
  it consumes forecasts and produces a schedule. Do not misrepresent it as a
  trained price forecaster.

## Repository hygiene

- Before edits run `git status`, inspect the branch and remote, and preserve
  unrelated user changes. Prefer a dedicated worktree/branch for scoped work.
- Never commit real IP ranges, site inventory, WireGuard keys, passwords,
  certificates, tokens or customer telemetry. Use placeholders and
  `.env.example` only.
- Do not change runtime infrastructure or production control behaviour unless
  the task explicitly requires it and relevant tests/commissioning evidence are
  available.
- Keep architecture and network documents in English first, followed by
  Bulgarian, and maintain paired EN/BG diagrams when topology changes.
- Test changes in proportion to risk. For documentation changes, validate links,
  Mermaid syntax and scan the diff for secrets before committing.
