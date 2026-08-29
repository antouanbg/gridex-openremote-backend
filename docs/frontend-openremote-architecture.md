# GridEx frontend and OpenRemote backend

## Product boundary

OpenRemote is the IoT/EMS backend and engineering console. Its standard Manager UI remains available only to GridEx administrators for commissioning, asset modelling, agent setup, rules and diagnostics. Customers and operators use the GridEx Energy OS frontend.

```text
Browser
  GridEx Energy OS (gridex.tech / app.gridex.tech)
            |
            | HTTPS JSON + live event stream
            v
  GridEx API / Backend-for-Frontend (api.gridex.tech)
            |
            | OAuth2 bearer token, REST and WebSocket
            v
  OpenRemote Manager (ems.gridex.tech)
            |
            | Modbus TCP Agent + MQTTS telemetry
            v
  ROCK Pi E / T-CAN485 nodes / SunStorage Pro 261
```

The browser never receives an OpenRemote service-user secret, MQTT password, vendor register address or direct route to the PCS.

## Authentication and tenancy

1. The portal uses OpenID Connect Authorization Code with PKCE against the OpenRemote/Keycloak realm.
2. The browser keeps only the short-lived user token required for the current session.
3. The GridEx API forwards the user token to OpenRemote; OpenRemote remains authoritative for realm roles and restricted asset links.
4. Each customer organisation is isolated by an OpenRemote realm. Restricted users are linked only to their permitted Site assets.
5. Machine-to-machine integrations use separate service users and never reuse a human account.

## Communication contracts

### Read path

| GridEx frontend request | GridEx API action | OpenRemote source |
|---|---|---|
| Site list | Return sites accessible to the current user | Asset hierarchy / restricted links |
| Current dashboard | Build one canonical snapshot | Battery, Control, Strategy and Meter assets |
| Charts and reports | Query and aggregate datapoints | Asset Datapoint API |
| Forecasts | Query predicted datapoints | Predicted Datapoint API |
| Alarms | Map alarms to GridEx severity and wording | Alarm API and alarm attributes |
| Live values | One authenticated stream to the browser | OpenRemote WebSocket AttributeEvents |

The frontend depends on the canonical GridEx model, not on the raw OpenRemote Asset JSON. The adapter is the only component that knows the OpenRemote attribute names and asset IDs.

### Command path

```text
GridEx screen
  -> GridEx API validation and audit context
  -> one atomic OpenRemote Control.powerCommand JSON value
  -> protected OpenRemote rule writes normalized Edge registers
  -> ROCK Pi E safety envelope
  -> SunStorage Pro 261 register 5005
```

The API never writes the mapped Modbus attributes separately. The protected OpenRemote rule validates the complete `powerCommand` object and then writes in this order:

1. `requestedPowerKw`
2. `enable`
3. `emsHeartbeat`
4. `commandSequence` last

ROCK Pi E ignores an incomplete command and applies every new sequence only once. Operator start/stop, reactive power and SOC-limit writes use the separate protected operator contract.

All cloud writes remain disabled with `GRIDEX_WRITES_ENABLED=false` until commissioning confirms addressing, sign, scale, word order, BMS limits, software fuse and heartbeat behaviour.

## Frontend runtime modes

The same frontend build supports two runtime configurations through `public/gridex-config.js`:

- `demo`: current representative data, no authentication and no control writes;
- `live`: GridEx API snapshots, history and commands after OIDC login.

No rebuild is required to change the API hostname, realm or default site. Only public connection metadata belongs in this file; secrets are forbidden.

## Deployment hostnames

| Hostname | Purpose | Public |
|---|---|---|
| `gridex.tech` | Product site and public demonstration | Yes |
| `app.gridex.tech` | Authenticated customer/operator portal | Yes, login required |
| `api.gridex.tech` | GridEx frontend API | Yes, authenticated routes |
| `ems.gridex.tech` | OpenRemote API, Keycloak and MQTTS | Restricted by roles |
| OpenRemote Manager UI | Engineering and commissioning | GridEx administrators only |

## Current implementation readiness

- The portal has a typed `GridexApiClient` and explicit demo/live runtime mode.
- The header shows whether it is using demo data, a live backend or an unavailable API.
- The deployable `services/gridex-api` adapter exposes health, site list, canonical snapshot and protected power-command endpoints.
- The adapter accepts the end-user bearer token and relies on OpenRemote for realm and asset authorization.
- CORS is allowlisted and command writes are locked by default.
- The remaining deployment inputs are the actual OpenRemote asset IDs, OIDC client configuration and the public reverse-proxy route for `api.gridex.tech`.
