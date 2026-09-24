# Device measurement history / История на измерванията

Current deployment update: see newest HANDOFF, 2026-09-20 17:43 UTC. Issuer
compatibility and the owner's temperature history asset/writer/worker are now
deployed. Synthetic Timescale write verified and cleaned up; physical ROCK
temperature publication and frontend acceptance remain blocked/pending.
Актуално внедряване: най-новия HANDOFF, 2026-09-20 17:43 UTC. Issuer поправката,
owner temperature asset/writer/worker са внедрени. Synthetic Timescale запис е
проверен и почистен; физически ROCK temperature publisher и frontend предстоят.

## English — decision and verified state, 2026-09-20

Use the existing **OpenRemote TimescaleDB** for historical device measurements:
smart meters, inverters, batteries, chargers and other explicitly mapped sensors.
Do not provision a second time-series database by default. GrideX PostgreSQL
continues to own memberships, Site permissions, configuration and current
heartbeat state; those records are not the historical measurement store.

Live audit: OpenRemote Manager 1.30.0; PostgreSQL image 17.9.0.1-slim;
TimescaleDB 2.26.4, toolkit 1.22.0. Existing hypertables:
`openremote.asset_datapoint` and `openremote.asset_predicted_datapoint`.
Compression is configured after seven days. The measurement table has **zero
rows**. GrideX has zero equipment `devices` bindings; the two pilot nodes live
in the separate gateway/heartbeat inventory. Receiving heartbeats therefore
does **not** prove that measurement history is being ingested.

### Per-device configuration

- Selected metric names must match the device's supported schema and units.
- `measurementPeriodSeconds`, `publishPeriodSeconds` and
  `heartbeatPeriodSeconds` are independent, validated device settings. `null`
  preserves the existing edge configuration; it is not a 15-minute default.
- The implemented blueprint history mode is `all_received`: OpenRemote stores
  accepted timestamped measurement events for selected attributes marked
  `meta.storeDataPoints: true`. Metadata is an object, not an array.
- `last_per_interval` may be represented by the profile validator, but asset
  creation rejects it until an ingestion implementation is deployed and tested.
- The profile stored on an asset is desired configuration, **not proof of
  acknowledgement by ROCK/ESP**. Edge application must follow the existing
  draft → approval → ROCK → device acknowledgement process.
- Missing values stay null, including online status; do not fabricate zeros,
  repeat stale data with fresh timestamps or record control requests as sensor
  measurements. `readOnly` metadata is a UI hint, not an authorization boundary.
- Keep ROCK receipt, ESP successful contact and sensor measurement timestamps
  separate. MQTT identity/topic binding determines the Site/device, not arbitrary
  payload IDs. History reads and export require backend Site authorization.

### Initial runtime blocker — superseded by the deployment update above

The current GrideX service token is issued by the public gridex issuer, while
Manager rejects it with `Invalid token issuer` (HTTP 401). Its current service
role is read-only. Do not disable issuer verification, expose master/admin or
give the ingestion worker master-admin credentials to bypass this problem.
No runtime image, auth setting, device binding or retention was changed by this
history preparation. Existing MQTT heartbeat reception remains untouched.

Next completion gates:

1. Resolve Manager's public-gridex/local-master issuer compatibility without
   breaking either login path; pass the mandatory auth regression gate.
2. Provision a least-privilege ingestion identity and explicit gateway/device
   → asset/attribute mappings. Reject unknown or foreign-Site topics.
3. Implement MQTT measurement ingestion with original observation timestamps,
   replay/deduplication handling and durable retry. Do not reuse latest-heartbeat
   rows as a substitute for a measurement stream.
4. Apply selected history metadata through the supported OpenRemote API;
   record rollback snapshots. No direct mutation of OpenRemote asset tables.
5. Verify physical measurement → MQTT → attribute event → Timescale row →
   authorized history API → frontend. Test two different device periods,
   disconnected devices, duplicates and cross-Site denial. A synthetic probe
   must be labelled separately and cannot satisfy physical acceptance.
6. Deliver profile editing/acknowledgement in existing Devices UI, not a new menu.

### Retention and export

Commercial policy: two years included; older history requires paid retention
or file export. Billing, archive/export and expiry notices remain unimplemented.
Do not enable automatic deletion before that workflow and a restore test exist.
Manager 1.30.0 uses global `OR_DATA_POINTS_MAX_AGE_WEEKS`, not independent tenant
retention. Its legacy per-attribute maximum can extend the global purge window;
it is not a safe paid per-Site storage policy. 104 weeks is shorter than two
calendar years; any eventual global baseline must account for this and chunk
granularity. Do not invent per-device retention support from deprecated metadata.
All operator settings must come from the single private backend `.env`.

Read-only audit: `bash scripts/check-timescale-history.sh`.

Sources: [Manager 1.30.0 datapoint service](https://github.com/openremote/openremote/blob/1.30.0/manager/src/main/java/org/openremote/manager/datapoint/AssetDatapointService.java),
[attribute metadata](https://github.com/openremote/openremote/blob/1.30.0/model/src/main/java/org/openremote/model/value/MetaItemType.java).

## Български — решение и проверено състояние, 2026-09-20

Историческите измервания от смарт метри, инвертори, батерии, зарядни и други
изрично описани сензори се пазят в съществуващата **OpenRemote TimescaleDB**.
Не добавяме втора time-series база по подразбиране. GrideX PostgreSQL остава за
членство, права по Обекти, конфигурации и текущ heartbeat, а не за историята.

Проверено: Manager 1.30.0; PostgreSQL image 17.9.0.1-slim; TimescaleDB 2.26.4,
toolkit 1.22.0. Има hypertables `openremote.asset_datapoint` и
`openremote.asset_predicted_datapoint`, компресия след седем дни. Таблицата за
измервания има **нула реда**. Няма equipment `devices` bindings в GrideX;
двата тестови възела са в отделния gateway/heartbeat инвентар. Получаването на
heartbeat **не доказва** запис на история.

### Настройки по устройство

- Изборът на показатели следва поддържаната схема и мерни единици.
- `measurementPeriodSeconds`, `publishPeriodSeconds`, `heartbeatPeriodSeconds`
  са отделни валидирани настройки. `null` запазва текущото edge поведение,
  не означава фиксирани 15 минути.
- Реализираният blueprint режим е `all_received`: избраните атрибути имат
  `meta.storeDataPoints: true` и пазят приетите timestamped събития.
  Metadata е обект, не масив.
- Validator може да представи `last_per_interval`, но създаването на asset го
  отказва до внедрена и проверена ingestion реализация.
- Профилът върху asset е желана конфигурация, **не потвърждение от ROCK/ESP**.
  Прилагането следва чернова → одобрение → ROCK → потвърждение от устройството.
- Липсващите стойности са null, включително online; без измислени нули,
  остарели данни с нови времена или команди, представени като измервания.
  `readOnly` е UI указание, не граница за сигурност.
- Разделяме ROCK receipt, ESP успешен контакт и време на измерването.
  MQTT identity/topic binding определя Обекта/устройството, не свободни payload
  IDs. Четенето и export изискват backend проверка на правата по Обект.

### Първоначален runtime блокер — заместен от актуализацията по-горе

Служебният GrideX token е от публичния gridex issuer, но Manager го отказва с
`Invalid token issuer` (HTTP 401). Текущата служебна роля е само за четене.
Не изключвай issuer проверката, не публикувай master/admin и не давай master
парола на ingestion worker като заобикаляне. Тази подготовка не променя runtime
image, auth настройки, device bindings или retention. MQTT heartbeat не е пипан.

Оставащи проверки за приключване:

1. Поправка на съвместимостта public gridex/local master issuer без счупване
   на входа; задължителните auth regression тестове.
2. Минимално привилегирована ingestion идентичност и точни mappings
   gateway/device → asset/attribute; отказ на чужди/неизвестни topics.
3. MQTT measurement ingestion с оригинални времена, replay/deduplication и
   устойчив retry. Последният heartbeat не замества потока от измервания.
4. Прилагане на history metadata през OpenRemote API с rollback snapshots,
   без директна промяна на asset таблиците.
5. Проверка реален сензор → MQTT → attribute event → Timescale → разрешен
   history API → frontend. Два различни периода, offline, дубликати, отказ
   между Обекти. Синтетичната проба се обозначава и не доказва физическа връзка.
6. Редакция/потвърждение на профили в съществуващите Устройства, без ново меню.

### Срок и export

Политика: две години включени; след това платено пазене или файл за сваляне.
Billing, archive/export и известията преди изтичане още не са реализирани.
Без автоматично изтриване преди този процес и проверен restore. Manager 1.30.0
ползва глобален `OR_DATA_POINTS_MAX_AGE_WEEKS`, не отделен срок за клиент.
Legacy максимумът по атрибут може да удължи общия срок — не е безопасна платена
политика по Обект. 104 седмици са по-малко от две календарни години; бъдещият
общ срок трябва да отчете това и chunk грануларността. Не приемай deprecated
metadata за работеща per-device retention. Всички операторски настройки са в
единния частен backend `.env`. Read-only проверка:
`bash scripts/check-timescale-history.sh`. Източниците са посочени по-горе.
