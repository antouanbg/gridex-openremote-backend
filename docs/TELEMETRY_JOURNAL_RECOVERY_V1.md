# Telemetry journal recovery contract v1 / Договор v1 за възстановяване на telemetry journal

**Status / Статус:** Draft for owner approval. No exporter, acknowledgement or
recovery worker is enabled by this document.

## English

### Cross-repository contract

This is the Backend implementation profile of the coordinated v1 contract.
`antouanbg/gridex-edge-gateway` carries the matching Edge profile. Both Pull
Requests must use the same schema version and cannot be released independently.

The recovery path is at-least-once delivery with backend deduplication. It uses
only the Site Router VPN and private mutually authenticated MQTT. It never
exposes the ROCK Pi filesystem, adds public MQTT, routes OT/BESS to the backend
or carries a device command.

### Required input and acknowledgement

Each future exported record requires a durable UUID `recordId`; the current
ROCK Pi process-local `sequence` is diagnostic only and is not a deduplication
key. A v1 record contains `schemaVersion`, `recordId`, logical site/gateway
IDs, UTC observation time, kind (`snapshot` or `transition`), normalized slot,
poll status and safe normalized telemetry. It excludes endpoints, credentials,
VPN data and control payloads.

Logical private topic templates are `gridex/v1/journal/records` and
`gridex/v1/journal/acks`; neither is a production topic binding. The backend
authorizes the source from its mutually authenticated client identity, not a
topic field. It returns an acknowledgement containing only `schemaVersion`,
`recordId`, `status` and `acceptedAt` after a successful database commit.
`accepted` and `duplicate` are successful delivery outcomes. `rejected` does
not permit Edge deletion and must produce an operator-visible audit error.
Acknowledgements cannot affect an Edge driver, relay, setpoint or write gate.

### Backend requirements

The future worker creates a PostgreSQL/Timescale record store with `record_id`
as a unique key and retains logical site/gateway IDs, observation time,
ingestion time, kind, normalized JSON payload and audit outcome. It commits
idempotently before acknowledgement. Only approved latest health/summary
attributes may be written to OpenRemote after persistence; OpenRemote is not a
raw journal store or acknowledgement authority.

The worker must prove duplicate, reordered, outage, restart and
acknowledgement-loss handling. It must not subscribe to an MQTT command topic,
perform a device write or create a direct backend-to-OT connection.

### Exact next action

Approve the cross-repository contract, then implement the schema migration,
deduplication tests and private recovery-ingestion worker in a separate Pull
Request coordinated with the Edge exporter change.

## Български

### Договор между repository-та

Това е Backend implementation profile на координирания v1 договор.
`antouanbg/gridex-edge-gateway` пази съответния Edge profile. Двата Pull
Request-а трябва да използват една и съща schema версия и не могат да се
издават независимо.

Recovery пътят е at-least-once доставка с backend deduplication. Ползва само
Site Router VPN и private взаимно удостоверен MQTT. Той никога не излага
файловата система на ROCK Pi, не добавя public MQTT, не route-ва OT/BESS към
backend и не пренася device команда.

### Задължителен вход и acknowledgement

Всеки бъдещ export-нат запис изисква устойчив UUID `recordId`; текущият
process-local `sequence` на ROCK Pi е само диагностичен и не е deduplication
ключ. v1 записът съдържа `schemaVersion`, `recordId`, логически site/gateway
ID, UTC време на наблюдение, kind (`snapshot` или `transition`), нормализиран
slot, poll status и безопасна нормализирана telemetry. Липсват endpoints,
credentials, VPN данни и control payload-и.

Логическите private topic шаблони са `gridex/v1/journal/records` и
`gridex/v1/journal/acks`; нито един не е production topic binding. Backend-ът
удостоверява източника от взаимно удостоверената client identity, а не от topic
поле. Той връща acknowledgement само с `schemaVersion`, `recordId`, `status` и
`acceptedAt` след успешен database commit. `accepted` и `duplicate` са успешни
резултати от доставката. `rejected` не разрешава Edge изтриване и трябва да
създаде операторски видима audit грешка. Acknowledgement-ите не могат да
влияят на Edge driver, relay, setpoint или write gate.

### Backend изисквания

Бъдещият worker създава PostgreSQL/Timescale record store с `record_id` като
unique ключ и пази логически site/gateway ID, време на наблюдение, време на
приемане, kind, нормализиран JSON payload и audit резултат. Той записва
idempotent преди acknowledgement. Само одобрени latest health/summary
attributes могат да се запишат в OpenRemote след съхранението; OpenRemote не е
raw journal store или acknowledgement authority.

Worker-ът трябва да докаже duplicate, reordered, outage, restart и
acknowledgement-loss обработка. Не трябва да subscribe-ва MQTT command topic,
да изпълнява device write или да създава директна backend-to-OT връзка.

### Точно следващо действие

Одобри договора между repository-тата, после имплементирай schema migration,
deduplication тестовете и private recovery-ingestion worker-а в отделен Pull
Request, координиран с промяната за Edge exporter.
