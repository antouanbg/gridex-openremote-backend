# MQTT device data and UI contract / MQTT данни и UI договор

## English — canonical

Scope: existing registered ROCK controller and ESP node; read-only commissioning.
ESP → ROCK → mTLS broker → validated worker → PostgreSQL → Site-authorized API
→ Devices. Browser never connects to MQTT. LAN test today; the same data contract
applies to future per-Site WireGuard-private or direct-mTLS transport.
This is a source-verified specification, not proof of physical deployment.

### 1. Messages already implemented in Edge source

Base topic: `gridex/v1/sites/{site}/edge/{gateway}`. Identity derives from an
approved certificate/topic/registered UUID binding; MQTT cannot create inventory.

| Topic suffix | Send / default | Data | Frontend destination |
| --- | --- | --- | --- |
| `/health` | ROCK every 10 s | `schemaVersion`, UTC `observedAt`, `gatewayId`, `state`, `pcsHeartbeatOk`, `controlReady`, `safeMode`, `northboundReady`, `nodeOnlineCount`, `nodeTotal` | Devices → ROCK: last backend receipt, freshness; operational details separately |
| `/nodes/{slot}/telemetry` | ROCK every 2 s | `slot`, logical `nodeAddress` (not IP), `nodeType`, `nodeState`, `driverId`, `online`, `lastSuccessfulContactAt`, `heartbeat`, `pollStatus`, `consecutiveFailures` | Devices → ESP: actual last successful contact, counter, freshness, failures |
| same node message | same sample | `quality`, `actualPowerKw`, `energyWh`, `deviceState`, `alarmBits` | Device measurements; energy screens only after valid driver/quality/commissioning |
| same node message | same sample | `ethernetStatus`, `modbusTcpStatus`, `driverReady`, `deviceBusStatus`, `watchdogStatus`, `recoveryCount`, `lastError` | Expandable device diagnostics, not global header/menu |

Every node message also contains `schemaVersion:1` and UTC `observedAt`.
Current worker persists ONLY heartbeat timestamps, online flag and counter;
the other fields above are published by Edge source but are NOT yet persisted
or exposed by this worker. Do not promise power/temperature charts from it.
Current source uses QoS 1; health is retained, node telemetry is not. Worker
rejects initial retained delivery. A new live health observation is required.
Journal recovery/replay is a separate future flow, never a live heartbeat.

### 2. Liveness and display rules

- `receivedAt`: backend clock when a newer accepted observation arrives.
- `observedAt`: ROCK observation clock; reject over 120 s old or over 5 s future.
- `lastSuccessfulContactAt`: successful ESP identity + telemetry read, not send
  time. Failed polling preserves it; never contacted = null. Heartbeat may wrap.
- ROCK freshness defaults: current ≤30 s, stale >30 s, offline >90 s. No record
  = unknown, not offline/zero. ESP cannot be current while its source ROCK is stale.
- UI must label both "Last message from ROCK" and "Last successful ESP contact",
  with absolute local time and relative age. Poll authenticated API every 10 s
  while visible; pause when hidden, back off on failure; never force logout for
  missing telemetry. Future UI acceptance must verify these refresh rules.
- Registered/config imported ≠ connected. Show separate provisioning revision,
  transport connection, data freshness, driver readiness and commissioning state.
- Unconfigured battery/inverter: "not commissioned / no valid measurements",
  not 0 kW or 0% SOC. `pcsHeartbeatOk=false` does not mean ESP or ROCK is dead.
- Only verified Site administrators currently access device-heartbeats. Future
  read-only sharing needs explicit grants; public demo must be sanitized and
  opt-in, not anonymous access to the owner's live inventory.

### 3. Selectable ROCK sensors — implementation prepared, activation remains per Site

The edge publisher and backend relay now support an allowlisted `sensor-profile`
inside the existing Devices settings, not a new menu. The publisher is gated by
`GRIDEX_SYSTEM_TELEMETRY_ENABLED` and never changes control/MODBUS behaviour.
Per-device activation still requires Site-admin approval and a matching ROCK
acknowledgement; the example image keeps the flag disabled until provisioned.

| Sensor ID | Unit | Proposed sample/send | Display |
| --- | --- | --- | --- |
| `cpuTemperatureC` | °C | 10 s / 30 s | ROCK health card and history |
| `uptimeSeconds` | s | 30 s / 30 s | ROCK details / restart evidence |
| `load1` | load (not %) | 30 s / 30 s | Diagnostics |
| `memoryAvailableBytes` | bytes | 30 s / 60 s | Available RAM and capacity |
| `storageDataFreeBytes` | bytes | 60 s / 60 s | Data partition headroom |
| `journalSizeBytes` | bytes | 60 s / 60 s | Journal backlog/storage, not recovery ACK |

Initial proposal enables temperature + uptime only when capability detection
confirms them. Unsupported sensors are "unavailable", never invented zeroes.
Linux thermal zone must be selected by supported type/capability, not blindly
`thermal_zone0`; convert millidegrees to °C and reject impossible/nonfinite values.
No arbitrary shell command, sysfs path or upload script may be entered in UI.
Temperature warning/critical thresholds are model-specific and versioned; no
automatic power/control action follows a temperature alarm in this test.

The implemented topic is `/system/telemetry` with exact per-gateway publish/read ACL:

```json
{"schemaVersion":1,"gatewayId":"gateway-example","observedAt":"2026-09-19T12:00:00Z","bootId":"opaque-boot-id","sequence":42,"configRevision":3,"samples":[{"sensorId":"cpu.temperature","value":48.2,"unit":"Cel","quality":"good","observedAt":"2026-09-19T12:00:00Z"}]}
```

The payload is capability-filtered and uses the approved metric IDs above. QoS 1, retain=false, max 32 KiB,
max 32 allowlisted samples; key deduplication by device/bootId/sequence. TLS
publisher binding overrides any claimed payload identity. Missing/invalid
samples do not refresh their last-good timestamp. Store latest and bounded
history separately. Proposed retention: raw 7 days, 5-minute aggregates 90 days,
then purge; implement retention jobs/capacity tests before enabling history.
Sensor intervals must be bounded (sample ≥5 s; send ≥sample and ≤300 s).
Sensor-profile cannot disable compulsory ROCK heartbeat or enlarge topic rights.

### 4. Provisioning lifecycle (future implementation)

1. ROCK reports supported capabilities/version after its one-time secure enrolment.
2. Admin selects sensors/intervals/visibility on the existing device and saves draft.
3. Backend validates Site scope, capabilities, limits and expected revision.
4. Admin explicitly approves revision. ROCK initiates authenticated fetch, validates
   and atomically applies it; no new SSH or inbound device management listener.
5. ROCK reports applied/rejected revision and bounded reason. Draft becomes active
   ONLY after matching device acknowledgement. Offline/timeouts remain pending;
   preserve previous active revision, retry idempotently, allow audited rollback.
6. Frontend displays supported/enabled/last sample/quality and config state.
   Certificate keys never appear in UI, MQTT samples, logs or Git.

Use the ONE private backend env for deployment defaults; Site/device choices are
versioned DB configuration, rendered to the existing protected ROCK config.
No new per-service settings file, no shared certificate between Sites.

### 5. Acceptance and execution ledger

| Item | Status |
| --- | --- |
| LAN 8883 proxy, synthetic mTLS/ACL tests | Verified in PR #29; not physical ROCK proof |
| Additive migration 007 | Applied with private pg_dump backup; archive listing checked, restore rehearsal pending |
| Physical ROCK certificate/endpoint/topic reconciliation | BLOCKED: no authenticated device access; imported file has no MQTT settings |
| API heartbeat deployment | Applied, healthy, actual SQL read verified; unrelated activation work preserved |
| Deploy worker | BLOCKED on verified physical certificate/topic binding |
| Real ROCK/ESP records → owner Devices screen | TODO; no synthetic records in real inventory |
| Sensor-profile API/collector/storage/UI | Implemented in edge publisher, backend relay/history API and Devices card; physical activation pending |
| Foreign-Site denial, expiry/reboot/duplicate/offline tests | Required before live acceptance |

## Български — същият договор

Обхват: вече заведени ROCK controller и ESP node, само наблюдение при заключен
commissioning. Пътят е ESP → ROCK → mTLS broker → валидиращ worker → PostgreSQL
→ Site API → Устройства. Браузърът не използва MQTT. LAN тестът и бъдещите
WireGuard-private/direct-mTLS режими използват еднакъв договор. Това е проверена
по кода спецификация, не доказателство за внедряване на физическия ROCK.

Базов topic: `gridex/v1/sites/{site}/edge/{gateway}`. Сертификатът, разрешеният
topic и регистрираният UUID се съпоставят изрично; MQTT не създава устройства.
Първата таблица изброява точно текущите полета и места за показване:

- `/health` на 10 s: версия/UTC време/gateway, работно състояние, PCS heartbeat,
  control/safe/northbound флагове и брой нодове. В ROCK картата се виждат последно
  backend получаване и актуалност; operational details са отделни.
- `/nodes/{slot}/telemetry` на 2 s: логическа идентичност (nodeAddress не е IP),
  online, успешен контакт, heartbeat, polling/грешки; показват се в ESP картата.
  Мощност/енергия/quality/аларми се показват като измервания само при валиден
  driver и commissioning. Ethernet/Modbus/bus/watchdog/recovery полетата са в
  разгъваема диагностика, не в глобалното меню.
- Текущият worker пази САМО heartbeat времена, online и брояч; останалите полета
  още не се пазят/показват чрез него. Source използва QoS 1, retained health и
  non-retained node telemetry. Първоначалният retained пакет се отказва; нужен е
  нов live health. Journal replay/recovery не е live heartbeat.

`receivedAt` е backend време на по-нов приет запис; `observedAt` е ROCK време
(отказ над 120 s старо/5 s бъдещо). `lastSuccessfulContactAt` е успешно ESP
identity+telemetry четене, не publish; при отказ се запазва, без контакт е null.
Броячът може да се превърти. Прагове: актуално ≤30 s, stale >30 s, offline >90 s;
без запис е unknown. ESP не е актуален, ако ROCK е stale. UI показва отделно
„Последно съобщение от ROCK“ и „Последен успешен контакт с ESP“ с местно време
и възраст. Предвидено е API обновяване на 10 s само при видим екран, backoff при
грешка, без logout за липсващи данни; това още изисква UI приемателен тест.

Заведено/импортирано не значи свързано. Provisioning revision, transport,
freshness, driver и commissioning се показват отделно. Няма fake 0 kW/0% SOC
при липсваща батерия; PCS heartbeat не определя жизнеността на ESP/ROCK.
Текущите права са verified Site admin. Бъдещо споделяне изисква grants; демото
е обезличено и opt-in, не публичен достъп до реалния inventory.

Системният publisher и backend relay вече поддържат allowlist профил за сензори
в съществуващите Устройства, без ново меню. Изпращането се включва с
`GRIDEX_SYSTEM_TELEMETRY_ENABLED`; примерният image остава изключен до одобрено
провизиране. Метриките са CPU температура `cpuTemperatureC` °C (10/30 s),
uptime `uptimeSeconds` s (30/30), load1 без % (30/30), RAM
`memoryAvailableBytes` (30/60), свободно data пространство
`storageDataFreeBytes` и journal size `journalSizeBytes` (60/60). По подразбиране температура/uptime само ако capability проверката ги
поддържа. Неподдържаното е unavailable, не нула. Thermal zone се избира по
поддържан тип, не сляпо zone0; millidegrees→°C, без невъзможни/nonfinite числа.
Няма произволни shell команди/sysfs paths от UI. Температурни прагове са
model-specific/versioned; няма автоматични команди към енергийното оборудване.

Предложеният `/system/telemetry` JSON по-горе не е реално измерване. QoS 1,
retain=false, до 32 KiB/32 allowlisted samples; dedup по device/bootId/sequence.
Certificate binding има приоритет пред заявена payload идентичност. Невалидни
проби не обновяват last-good. Latest/history се пазят отделно; предложено
съхранение: raw 7 дни, 5-minute aggregates 90 дни, после purge. Нужни са jobs и
capacity тестове преди историята. Sample ≥5 s; send ≥sample и ≤300 s. Изборът
на сензори не изключва задължителния heartbeat и не разширява topic права.

Provisioning: ROCK заявява capabilities след еднократно сигурно enrollment;
admin избира сензори/интервали/видимост и записва чернова; backend валидира Site,
capabilities, лимити и revision. След изрично одобрение ROCK сам изтегля,
валидира и прилага атомарно; без нов SSH/inbound management listener. Active е
само след matching applied acknowledgement. Offline/rejected/timeout остават
pending или rejected с причина; пази се предишната версия, idempotent retry и
audit rollback. UI показва supported/enabled/last sample/quality/config status.
Без ключове в UI/MQTT/log/Git. Deployment defaults са в единния backend env,
Site изборите — versioned DB и съществуващия защитен ROCK config.

Статус: LAN proxy и синтетични mTLS/ACL тестове са проверени; publisher, relay,
history API и картата в Устройства са реализирани, но физическото включване на
профила за конкретен Site остава след одобрено провизиране. Миграция 007 е
приложена с частен pg_dump backup и проверен archive listing, без restore
репетиция. Физическото съпоставяне е BLOCKED от липсващ удостоверен достъп и
липсващи MQTT настройки във внесения файл. Worker/API runtime, реални данни към
сайта, sensor-profile реализация и security/offline/reboot приемане предстоят.
Последващо обновяване: heartbeat API вече е внедрен, healthy, с проверено реално
SQL четене; worker остава блокиран от непроверен physical certificate/topic binding.
Не презаписвай несвързаната activation работа и не записвай synthetic данни към
реалните устройства.
