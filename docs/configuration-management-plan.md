# GrideX configuration management plan / План за управление на конфигурацията

## English

### Service boundary

`gridex-api` is the browser-facing configuration service. It authorises the
user through Keycloak, validates site membership and role, stores immutable
configuration revisions in PostgreSQL, and publishes only an approved
operational subset to OpenRemote. The portal never receives OpenRemote service
credentials or raw device connection data.

```text
Portal -> GrideX API -> PostgreSQL draft/revision/audit
                         |
                         +-> validation -> simulation -> activation/outbox
                                                        |
                                                        +-> OpenRemote adapter
                                                            -> Assets/attributes
```

PostgreSQL is the canonical source for user intent and durable configuration.
OpenRemote is the canonical source for live Asset state, datapoints, alarms,
device capabilities and manufacturer/BMS limits. The Edge remains authoritative
for register mappings, local safety, heartbeat and final command clamping.

### PostgreSQL fields by scope

All scopes use `site_configurations`: `id`, `site_id`, `section`, `revision`,
`base_revision`, `configuration`, `status`, `validation`, `simulation_result`,
`created_by`, `created_at`, `updated_at`, `openremote_sync_state`,
`openremote_applied_revision`, `openremote_event_id`, `applied_at`.

| Scope | Required configuration payload | Conditional/optional |
|---|---|---|
| `site` | name, siteCode, countryCode, latitude, longitude, timezone, marketCode | trader/coordinator and schedule codes when market participation is enabled |
| `pv` | arrays: name, enabled, orientationProfile, mountingType, trackingType, dcKwp, tiltDeg, azimuthDeg, performanceRatio, inverterDeviceId | moduleLayout for trackers; east/west split for east-west; temperature coefficient, shading and coordinate overrides |
| `battery_pcs` | systemType, coupling, manufacturer, model, usableCapacityKwh, ratedPcsPowerKw, min/max SOC, efficiencies, warranted cycles, assetValueEur, usefulLifeMonths | residual value, grid-charge/export permission, reserve SOC and commercial caps |
| `metering_grid` | PCC meter, sign convention, CT/VT, maximum import/export, software-fuse margin, unavailable-meter policy | PV/BESS/load submeters and zero-export tolerance |
| `market_tariffs` | EUR currency, day-ahead source, validity and versioned import/export components | trader commission, imbalance risk, schedule recipient/channel/deadline |
| `forecast` | two price models, weather provider, PV/load model, horizon, 15-minute resolution, confidence, maximum age, fallback | ERP load input, model weights and training window |
| `strategy` | strategy code, fallback mode, control/re-optimisation interval, SOC/grid policy and lossProtection mode | price floors, minimum margin, low-solar 80% reserve, peak shaving and flexible-load policy |
| `loads_ev` | load/EV Asset relation, priority, min/max power, availability | energy target/deadline, ERP mapping, OCPP tariff and interruption policy |
| `edge_devices` | ROCK Pi controller, gateway list, ports, device type, driver key/version and one-device-per-gateway relationship | deployment package and non-secret connection references |
| `notifications_access` | recipients, severity, channels, edit/activate roles and approval policy | quiet hours, escalation, reports and retention |

Physical PV rows are also normalised in `pv_arrays` so the forecast worker can
query them safely without interpreting an arbitrary JSON document. The table
enforces valid ranges, tracker layout and a 100% east-west split.

`configuration_openremote_bindings` maps local resources to Asset IDs and
attributes. `configuration_outbox` guarantees retriable, idempotent activation.
It contains no secrets. Connection credentials and provider tokens are secret
references resolved at runtime.

### OpenRemote projection

| Asset | Configuration written after activation | Runtime read from OpenRemote |
|---|---|---|
| Site Asset | location, timezone, market code, active configuration revision | online/quality, aggregated live power |
| SolarPVAsset | DC kWp, tilt, azimuth, PR, loss inputs, active revision | generation and 72-hour forecast series |
| BatteryAsset | usable capacity and approved SOC policy | SOC/SOH, temperatures, BMS charge/discharge limits, energy counters |
| ElectricityStorageAsset/PCS | approved power envelope and permissions | actual/requested/applied power, state and faults |
| Meter Asset | measurement role and sign convention | power, energy, voltage, current, frequency, quality |
| EVSE/Load Asset | priority, availability window and bounded target | availability, live consumption and applied command |
| Strategy/Control Asset | desired strategy revision and bounded desired setpoint | applied revision, safety state, rejection reason |

No user value can replace a BMS limit. Activation fails closed when required
telemetry is stale or invalid. OpenRemote writes are performed by a worker from
the outbox; the request transaction never performs a remote call.

### Lifecycle and concurrency

1. Save creates a `draft` using `If-Match` optimistic concurrency.
2. Validate returns field paths, errors and warnings and stores the result.
3. Simulate uses pinned forecast/tariff/model versions and stores the result.
4. Activate requires a completed simulation, permission and `Idempotency-Key`.
5. One transaction changes status to `activating` and inserts the outbox event.
6. The worker updates Assets, verifies the applied revision and marks `applied`.
7. Failures remain retriable and visible; rollback creates a new revision.

### Implemented in this pull request

- migration `003_configuration_centre.sql`;
- canonical section names and conditional PV validation;
- draft, validate, simulate and activation endpoints;
- transactional activation outbox;
- ordered execution of all SQL migrations;
- API tests proving that save does not activate OpenRemote directly.

The next runtime increment is the outbox worker and concrete OpenRemote
attribute mapper. Until then, queued activation remains `pending` and no field
equipment is modified.

## Български

### Граница на услугите

`gridex-api` е конфигурационният backend за портала. Той проверява Keycloak
самоличността, организацията, обекта и ролята; пази неизменяеми версии в
PostgreSQL; валидира и симулира; и изпраща към OpenRemote само одобрения
оперативен набор. Порталът няма OpenRemote service credentials и не вижда
суровите параметри за връзка към устройствата.

PostgreSQL е каноничен за потребителските настройки, версии, тарифи, връзки,
права и одит. OpenRemote е каноничен за Assets, телеметрия, аларми, флагове за
качество, способности и моментни BMS лимити. Edge е каноничен за register maps,
локална безопасност, heartbeat и окончателното ограничаване на командата.

### Разпределение на данните

Десетте раздела са `site`, `pv`, `battery_pcs`, `metering_grid`,
`market_tariffs`, `forecast`, `strategy`, `loads_ev`, `edge_devices` и
`notifications_access`. Всеки има ревизия, базова ревизия, JSON payload,
валидация, симулация, статус и отделен статус на синхронизацията.

PV масивите са и нормализирани в `pv_arrays`: тип ориентация, монтаж, fixed/
single-axis/dual-axis, `1P`/`2P`, DC kWp, наклон, азимут, PR, загуби, координати
и връзка към инвертор. При тракер layout е задължителен; при изток–запад двата
дяла трябва да дават 100%. Реално различните източен и западен скат е по-добре
да са два отделни масива.

Батерийните договорни и икономически полета включват тип, AC/DC coupling,
капацитет, PCS мощност, SOC политика, ефективности, гарантирани цикли, стойност
на актива, остатъчна стойност и полезен живот. Моментните BMS лимити, SOC, SOH,
температури и аварии са само за четене от OpenRemote и никога не се заместват
с потребителска настройка.

### Жизнен цикъл

**Чернова → Валидация → Симулация → Активиране → Outbox → OpenRemote →
Приложена версия.** `If-Match` пази от загуба на паралелни промени, а
`Idempotency-Key` пази от повторно активиране. Remote call не се изпълнява в
HTTP транзакцията. Пароли, ключове и токени не се записват в payload-а.

Този PR реализира базовата миграция, валидирането, API жизнения цикъл,
транзакционния outbox и теста, че записът на чернова не променя OpenRemote.
Следваща runtime стъпка е worker-ът, който прилага mapping-а и потвърждава
приложената ревизия. До него activation остава `pending` и не управлява реално
оборудване.
