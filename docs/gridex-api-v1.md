# GrideX API v1: frontend ↔ backend ↔ OpenRemote

## English

### Decision

The browser never talks directly to OpenRemote Assets, MQTT or site devices. It authenticates with OIDC Authorization Code + PKCE and sends its short-lived access token only to `gridex-api`. The API verifies the token, checks PostgreSQL organisation/site membership and a role-to-permission map, resolves only the OpenRemote Asset IDs bound to that site, then returns stable GrideX DTOs.

```text
Browser / GrideX portal
  ├─ OIDC + PKCE ───────────────> Keycloak
  └─ HTTPS JSON / SSE + token ──> gridex-api
                                    ├─ membership, configuration, audit ─> GrideX PostgreSQL
                                    └─ service account, internal REST ───> OpenRemote Assets
                                                                              └─ VPN-only Modbus/MQTT ─> site router ─> ROCK Pi E / nodes
```

The service account and raw OpenRemote structure stay server-side. Missing or stale telemetry is returned as `null` plus a quality state; it is never converted to a plausible zero.

### Service ownership

`services/gridex-api` is the backend-for-frontend service. It:

- validates Keycloak JWT issuer, audience, signature and expiry;
- maps roles to explicit permissions and checks site membership in PostgreSQL;
- creates and manages inverter, battery, smart-meter and EVSE Assets in OpenRemote;
- stores site, hardware, device binding, configuration, strategy, alarm, incident, notification, tariff and audit metadata in GrideX PostgreSQL;
- normalises OpenRemote attributes into GrideX device and site snapshot DTOs;
- exposes a filtered live SSE stream;
- writes only to the Strategy or Control Asset, never directly to vendor registers.

OpenRemote owns live Asset attributes, datapoints, rules and protocol Agents. PostgreSQL owns product configuration, tenancy, revisions, topology and audit. No telemetry history is duplicated by default.

### Implemented API

| Route | Purpose | Permission |
|---|---|---|
| `GET /health` | API/OpenRemote readiness | public |
| `GET /api/v1/me` | session identity and effective permissions | authenticated |
| `GET, PUT /api/v1/me/preferences` | per-user locale, units, timezone, theme and notification preferences | authenticated |
| `GET /api/v1/sites` | membership-filtered site list | `site:read` |
| `GET /api/v1/device-types` | device and supported hardware catalogue | `asset:read` |
| `GET /api/v1/strategies/catalog` | role/capability-filtered strategy catalogue | `strategy:read` |
| `GET /api/v1/sites/{siteId}/hardware` | controller, gateways, ports and assigned devices | `site:read` |
| `POST /api/v1/sites/{siteId}/hardware-configurations` | create a validated hardware draft | `hardware:manage` |
| `GET, POST /api/v1/sites/{siteId}/devices` | list or provision devices and OpenRemote Assets | `asset:read` / `asset:manage` |
| `GET, PATCH /api/v1/sites/{siteId}/devices/{deviceId}` | live view or revision-safe update | `asset:read` / `asset:manage` |
| `GET, PUT /api/v1/sites/{siteId}/configurations/{section}` | versioned battery/tariff/forecast/grid/EVSE/notification/trader/balancing settings | `site:read` / `configuration:manage` |
| `GET /api/v1/sites/{siteId}/snapshot` | canonical dashboard snapshot | `asset:read` |
| `GET /api/v1/sites/{siteId}/events` | filtered live snapshot stream | `asset:read` |
| `GET /api/v1/sites/{siteId}/strategy` | current active strategy | `strategy:read` |
| `POST/PUT /api/v1/sites/{siteId}/strategy/drafts...` | revision-safe strategy drafts | `strategy:draft` |
| `POST .../validate`, `POST .../simulate` | validate capabilities and queue an optimizer simulation | `strategy:draft` / `strategy:simulate` |
| `POST .../activate` | request activation only after a completed matching simulation | `strategy:activate` |
| `GET .../status`, `GET .../versions` | desired/applied state and audited history | `strategy:read` |
| `POST /api/v1/sites/{siteId}/commands/power` | audited desired-power command | `command:write` |

All configuration updates use numeric `If-Match` revisions. Provisioning, activation and control writes stay locked until `GRIDEX_WRITES_ENABLED=true` after commissioning.

### Asset blueprints

| GrideX type | OpenRemote type | Core telemetry | Controlled through |
|---|---|---|---|
| inverter | `ElectricityProducerAsset` | power, PV power, AC values, frequency, energy, state, alarms | protected Control/Strategy rules |
| battery | `ElectricityBatteryAsset` | SOC/SOH, DC values, power, BMS limits, temperature, energy counters | protected Control/Strategy rules |
| meter | `ElectricityConsumerAsset` | PCC power, phases, frequency, import/export energy | read-only; software-fuse input |
| EVSE | `ElectricityChargerAsset` | connector state, charging power, session/total energy | protected load-limit rule |

Every Asset carries only non-secret identity metadata and restricted-read telemetry attributes. Driver connection details stay in PostgreSQL and are omitted from frontend responses.

### Hardware database rules

A hardware configuration contains exactly one `rock-pi-e` controller and zero
or more OLIMEX ESP32-EVB nodes. Production uses
`olimex-esp32-evb-ea-ind`; `olimex-esp32-evb-lab` is for bench work. Every
node has exactly one CAN or isolated RS485 device port. A device binds to one
node and port, so mixed brands/types on one node are rejected.

The site router owns WireGuard. ROCK Pi E and ESP32 have no WireGuard peer; they use the router tunnel. CONTROL and TELEMETRY networks stay separated, OT/BESS is not routed to the backend, and public MQTT 8883 is not exposed after VPN-only migration.

### Driver catalogue status

`config/driver-reference-catalog.yaml` distinguishes `confirmed` production mappings from `needs-lab-validation` references. Suntech SunStorage Pro 261 is confirmed. The ha-solarman profiles and linked protocol documents are registered as reference knowledge only until exact model and firmware are validated in the lab.

### No-sale-at-loss and battery provenance

Loss protection evaluates two physical sale paths independently: `pv_direct` and `battery_discharge`. The first never receives a battery-cycle charge. The second includes source-energy cost, round-trip conversion loss and, in full-cost mode, battery degradation and asset depreciation. Both paths include trader/exchange/export fees, optional imbalance risk and the configured minimum margin.

Two selectable policies are supported: `cash_cost` (incremental cash expenses) and `full_cost` (cash expenses plus enabled depreciation/degradation). A negative-price export block is independent and enabled by default.

The 15-minute energy ledger attributes charge to PV or grid using simultaneous PV, PCC, site-load and battery measurements. The 24-hour projection reports `gridChargeEquivalentCycles`, `pvChargeEquivalentCycles` and total equivalent full cycles separately. Forecast metadata includes up to two price forecast sources, weather/PV/load versions, sunrise/sunset, tariffs and battery asset revision so every profit number is reproducible.

---

## Български

### Решение

Браузърът никога не комуникира директно с OpenRemote Assets, MQTT или устройствата в обекта. Той се идентифицира чрез OIDC Authorization Code + PKCE и изпраща краткотрайния token само към `gridex-api`. API услугата валидира token-а, проверява членството в организация/обект и ролята в PostgreSQL, намира само разрешените OpenRemote Asset ID и връща стабилни GrideX структури.

`services/gridex-api` е липсващият досега backend-for-frontend слой. Той управлява правата, нормализацията, Assets, конфигурациите, хардуерната топология, ревизиите и audit trail. OpenRemote запазва живата телеметрия, datapoints, rules и Agents. GrideX PostgreSQL пази продуктовата конфигурация, организациите, членството, връзките към Asset ID, аларми/инциденти/известия и тарифи. По подразбиране не дублираме телеметричната история.

### Устройства и Assets

Поддържаните типове са инвертор, батерия, smart meter и EVSE. Всеки получава отделен OpenRemote Asset blueprint, унифицирани атрибути и GrideX DTO. Липсваща телеметрия се връща като `null` с качество `INVALID` или `STALE`, а не като подвеждаща нула. Детайлите за адреси, credentials и протоколна връзка остават в backend базата и не се връщат към браузъра.

### Конфигурация и хардуер

За всеки обект се пазят версионирани секции за батерия/ДМА, тарифи, прогнози, мрежа, EVSE, известия, търговски график и балансиране. Стратегиите имат отделни draft и active ревизии. Активирането записва един цял конфигурационен обект в Strategy Asset; защитените OpenRemote/Edge правила продължават да прилагат safety envelope.

Хардуерната конфигурация изисква точно един ROCK Pi E контролер и избрани отделни gateway нодове. Към един gateway и един порт се допуска само едно активно устройство; в v1 не се допуска смесване на различни марки и типове на един gateway.

WireGuard е само на Windows backend и site router-а. ROCK Pi E и ESP32 използват тунела на рутера. CONTROL и TELEMETRY мрежите са разделени, OT/BESS не се route-ва директно към backend, а публичен MQTT 8883 не се публикува след VPN-only миграцията.

### Статус на комуникационните карти

`config/driver-reference-catalog.yaml` разделя потвърдените карти от референтните. Suntech SunStorage Pro 261 е `confirmed`. Профилите и документите от ha-solarman са записани като `needs-lab-validation` и не се представят като готови GrideX драйвери, докато не се потвърдят точният модел, firmware, адресиране, word order, мащаб, знаци и безопасност на командите.

### „Не продавай на загуба“ и произход на енергията

Икономическата защита смята отделно `pv_direct` и `battery_discharge`. При директна PV продажба няма разход за батериен цикъл. При продажба през батерията се включват цената на енергийния източник, загубите от преобразуване и — в режим `full_cost` — деградацията и ДМА. И при двата пътя се следят търговски/борсови/мрежови такси, риск от небаланс и минимален марж.

Режимът `cash_cost` защитава само текущите парични разходи, а `full_cost` включва и избраните разходи за деградация/ДМА. Отделно може да се блокира износът при отрицателна цена.

15-минутен energy ledger определя колко от заряда идва от PV и колко от мрежата. Прогнозата за следващите 24 часа показва отделно grid-charge equivalent cycles, PV-charge equivalent cycles и общите EFC. Всяко изчисление пази версиите на двете ценови прогнози, weather/PV/load прогнозата, изгрев/залез, тарифата и battery asset конфигурацията.
