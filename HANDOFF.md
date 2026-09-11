# Handoff — GrideX OpenRemote backend

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## Purpose / Предназначение

This file is the durable backlog for backend work that is designed but not yet
implemented, deployment-verified or commissioned. It contains no secrets,
production addresses, customer inventory or actual configuration values.

Този файл е трайният backlog за backend работа, която е проектирана, но още не
е имплементирана, проверена при deployment или въведена в експлоатация. Не
съдържа тайни, production адреси, клиентска инвентаризация или реални стойности
на конфигурация.

## Deferred work / Отложена работа

1. **Provision the separate GrideX PostgreSQL/Timescale database / Отделна GrideX PostgreSQL/Timescale база**
   - Dependency: approved Docker image/tag, persistent volume location,
     database-secret provisioning and the final Windows 11 Docker Compose
     deployment plan.
   - Acceptance: Compose starts a dedicated `gridex-data-db` service with a
     persistent volume, healthcheck, non-superuser application role and
     TimescaleDB extension. `data-services` reaches it only through the
     internal Docker network using a secret-backed `DATA_DB_DSN`; no database
     port is publicly exposed.
   - Next action: add the dedicated database service, migrations runner,
     healthcheck and secret-file configuration to Compose; validate a restart
     and a `dam_price` upsert on the Windows 11 backend.

2. **Schedule the ENTSO-E A44 worker / Периодично изпълнение на ENTSO-E A44 worker-а**
   - Dependency: the Docker secret file and `DATA_DB_DSN` must be configured
     on the Windows 11 backend host; the supplier asset must contain a valid
     bidding-zone EIC.
   - Acceptance: one scheduled run imports a bounded day-ahead period, retries
     transient failures with backoff, writes a `fetch_log` record and never
     logs the security token or its URL.
   - Next action: implement a scheduler command that reads enabled supplier
     assets and invokes the existing `fetch-a44` operation.

3. **Discover supplier Assets and synchronise prices / Откриване на supplier Assets и синхронизация на цени**
   - Dependency: final OpenRemote Asset query and attribute-write contract.
   - Acceptance: the worker reads only enabled Assets, persists A44 data in
     PostgreSQL, updates the approved OpenRemote price/predicted attributes,
     records success/failure audit information and does not expose the token to
     browser clients.
   - Next action: implement Asset discovery in `services/data-services` and
     add mocked OpenRemote contract tests.

4. **Complete forecasting orchestration / Пълна оркестрация на прогнозите**
   - Dependency: the ENTSO-E import scheduler, Open-Meteo discovery contract
     and the agreed forecasting-model selection per Site.
   - Acceptance: prices, weather, PV and load inputs produce versioned 96 ×
     15-minute forecast/schedule data; the result is stored, attributable to a
     model run and supplied to OpenRemote Strategy/Control Assets without
     bypassing Edge safety.
   - Next action: add the orchestration worker after market and weather Asset
     discovery are available.

5. **Commission the Docker secret and private runtime / Въвеждане на Docker secret и private runtime**
   - Dependency: access to the Windows 11 backend host and a newly generated
     ENTSO-E token stored outside Git.
   - Acceptance: `docker compose config` and service health checks pass; the
     secret is readable only by `data-services`; no public MQTT `8883` listener
     exists; one A44 fetch is completed without the token appearing in logs.
   - Current evidence: a read-only A44 HTTPS/CLI test returned HTTP 200 and
     parsed 288 15-minute points without persistence or token output. Docker
     secret mounting and PostgreSQL persistence remain uncommissioned.
   - Next action: create the ignored secret file on the backend host, deploy
     the Compose stack and run a read-only A44 import for a configured test
     zone.

## Completed baseline / Изпълнена основа

- Docker-secret-first token loading with a local-development fallback.
- ENTSO-E `A44` request client, UTC periods, XML parsing and 15-minute
  normalisation.
- Idempotent PostgreSQL `dam_price` upsert and `gridex-data market fetch-a44`
  CLI command.
- Offline request tests and one read-only live A44 CLI test; no real security
  token is committed or used by tests.

## Resume instruction / Инструкция при продължаване

Read `CODEX_STATE.md`, this file and the repository status first. Verify the
actual repository state before treating any entry as complete. Update this file
and `CODEX_STATE.md` before completing a related task.
