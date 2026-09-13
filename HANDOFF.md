# Handoff — GrideX OpenRemote backend

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## Prioritized work possible before the backend host exists / Приоритизирана работа преди наличието на backend машина

The numbered work below may be implemented, reviewed and tested locally or in
CI without a Windows 11 backend host, live credentials, live OpenRemote or a
private MQTT broker. It must not be reported as commissioned until the separate
deployment evidence exists.

Посочената по-долу номерирана работа може да се имплементира, прегледа и
тества локално или в CI без Windows 11 backend машина, реални credentials,
live OpenRemote или private MQTT broker. Тя не трябва да се отчита като
commissioned преди отделните deployment доказателства.

## Progress statistics / Статистика на напредъка

**Baseline:** 9 pre-deployment tasks. **Completed:** 0 (0%). **In review:** 1
(item 1). **Queued:** 8 (items 2–9). **Blocked within this numbered backlog:**
0. The separate Windows-host commissioning items remain blocked outside this
count. Last updated: 2026-09-13.

**База:** 9 pre-deployment задачи. **Изпълнени:** 0 (0%). **В преглед:** 1
(точка 1). **Чакащи:** 8 (точки 2–9). **Блокирани в този номериран backlog:**
0. Отделните commissioning точки за Windows машината остават блокирани извън
този брой. Последно обновяване: 2026-09-13.

1. **Approve the telemetry recovery v1 contract / Одобряване на telemetry recovery v1 договора**
   - Repository: coordinated `antouanbg/gridex-edge-gateway` and
     `antouanbg/gridex-openremote-backend` work.
   - Status: **in review**. The bilingual contract draft exists in both
     repositories and was reviewed for no secrets, no public route and no
     device-control path; the owner approval is still required.
   - Статус: **в преглед**. Двуезичната чернова на договора съществува и в
     двете repository-та и е прегледана за липса на secrets, public route и
     device-control path; все още е нужно одобрение от собственика.
   - Output: approved record identity, acknowledgement, retention and rejection
     rules in `docs/TELEMETRY_JOURNAL_RECOVERY_V1.md`.
   - Next action: owner review; no code is enabled by approval alone.

2. **GrideX PostgreSQL/Timescale migrations / GrideX PostgreSQL/Timescale миграции**
   - Repository: `antouanbg/gridex-openremote-backend`.
   - Output: versioned SQL migrations for tenancy, Sites, configurations,
     telemetry, alarms, audit and journal-record deduplication, with rollback
     and fixture tests.
   - Next action: implement migrations against a local disposable database or
     SQL parser test harness; do not require production values.

3. **GrideX API contracts, validation and authorization tests / GrideX API договори, validation и authorization тестове**
   - Repository: `antouanbg/gridex-openremote-backend`.
   - Output: stable frontend DTOs, configuration revisions, audit events,
     tenant/role middleware and mock Keycloak claims tests.
   - Next action: implement API routes and validators with test doubles only.

4. **OpenRemote asset adapter and outbox tests / OpenRemote asset adapter и outbox тестове**
   - Repository: `antouanbg/gridex-openremote-backend`.
   - Output: Asset blueprints, attribute mappings, idempotent outbox model and
     mocked REST contract tests for inverter, battery, meter and EVSE Assets.
   - Next action: implement the adapter without an actual OpenRemote endpoint.

5. **Journal recovery ingestion worker / Journal recovery ingestion worker**
   - Repository: `antouanbg/gridex-openremote-backend`, coordinated with Edge.
   - Output: parser, authentication boundary, PostgreSQL deduplication and ACK
     state machine with duplicate, restart, reordered and outage test fixtures.
   - Next action: implement only after item 1 is approved; no live MQTT
     connection, command subscription or device control is included.

6. **Edge journal exporter contract implementation / Edge journal exporter implementation**
   - Repository: `antouanbg/gridex-edge-gateway`.
   - Output: durable `recordId`, bounded export checkpoint and outbound-only
     export client tested against a fake broker/ACK fixture.
   - Next action: coordinate its schema fixtures with item 5; do not deploy it
     to ROCK Pi before private MQTT commissioning.

7. **Forecasting and optimisation foundation / Основа за forecasting и optimisation**
   - Repository: `antouanbg/gridex-openremote-backend`.
   - Output: model-selection contract, market/weather/PV/load fixtures,
     96 × 15-minute schedule model and tests for “do not sell at a loss”.
   - Next action: use fixtures and the published IBEX model interface; defer
     live supplier calls and schedule activation.

8. **Docker, Windows and secret templates / Docker, Windows и secret templates**
   - Repository: `antouanbg/gridex-openremote-backend`.
   - Output: Compose validation, healthchecks, volumes, `.env.example`, Docker
     Secret templates and PowerShell deployment/rollback/backup runbooks.
   - Next action: validate syntax locally; do not add actual secrets or run
     production containers.

9. **Automated quality and security checks / Автоматични quality и security проверки**
   - Repository: all three GrideX repositories where relevant.
   - Output: CI lint, unit/contract tests, Compose validation, secret scan and
     documentation-link checks.
   - Next action: add repository-local checks with fixtures only.

## Blocked until the Windows 11 backend is available / Блокирано до наличието на Windows 11 backend

- Docker service startup and health evidence.
- Real PostgreSQL/Timescale migrations and backup/restore proof.
- Real Keycloak login, OpenRemote Asset synchronization and private MQTT TLS.
- WireGuard peer provisioning and Site Router firewall verification.
- End-to-end ROCK Pi → broker → database → OpenRemote → frontend evidence.

## English

### Planned: local telemetry journal recovery ingestion

The ROCK Pi local NDJSON journal is deployed and bounded, but no journal export,
backend acknowledgement, replay or recovery worker exists yet. The existing
private MQTT ingestion description covers live telemetry only and must not be
treated as journal recovery.

- Dependencies: a versioned Edge-to-backend record and acknowledgement
  contract; private MQTT TLS identities; the dedicated GrideX PostgreSQL/
  Timescale service; and an approved OpenRemote mapping for accepted summaries.
- Required design: the Edge side must export only normalized records outbound
  through the Site Router VPN. The backend must authenticate the source, use a
  stable record identity rather than a process-local sequence alone, persist
  idempotently before acknowledgement, and never expose a ROCK Pi filesystem
  or route OT/BESS to the backend.
- Acceptance evidence: duplicate, reordered, interrupted and restart cases are
  tested; records are retained in PostgreSQL with audit fields; only approved
  live summaries reach OpenRemote; no MQTT command subscription or device
  control path is introduced.
- Contract draft: `docs/TELEMETRY_JOURNAL_RECOVERY_V1.md`.
- Exact next action: agree the versioned export/acknowledgement contract with
  `antouanbg/gridex-edge-gateway`, then implement the PostgreSQL deduplication
  migration and recovery ingestion worker in a separate backend Pull Request.

## Български

### Планирано: recovery ingestion на local telemetry journal

Local NDJSON журналът на ROCK Pi е внедрен и ограничен по размер, но все още
няма export на журнала, backend acknowledgement, replay или recovery worker.
Съществуващото описание за private MQTT ingestion важи само за live telemetry
и не трябва да се приема за journal recovery.

- Зависимости: versioned Edge-to-backend record и acknowledgement договор;
  private MQTT TLS идентичности; отделната GrideX PostgreSQL/Timescale услуга;
  и одобрена OpenRemote mapping схема за приетите обобщени данни.
- Задължителен дизайн: Edge страната изнася само нормализирани записи outbound
  през Site Router VPN. Backend-ът удостоверява източника, използва устойчив
  record identity вместо само process-local sequence, записва idempotent преди
  acknowledgement и никога не излага ROCK Pi файлова система или не route-ва
  OT/BESS към backend.
- Приемателни доказателства: тествани са duplicate, reordered, interrupted и
  restart случаи; записите се пазят в PostgreSQL с audit полета; само одобрени
  live summaries достигат OpenRemote; не се добавя MQTT command subscription
  или device control path.
- Чернова на договора: `docs/TELEMETRY_JOURNAL_RECOVERY_V1.md`.
- Точно следващо действие: договори versioned export/acknowledgement договора
  с `antouanbg/gridex-edge-gateway`, после имплементирай PostgreSQL
  deduplication migration и recovery ingestion worker в отделен backend Pull
  Request.
