# CODEX_STATE.md

## Deployed checkpoint / Внедрено — 2026-09-15

Owner explicitly approved local migrations 003/004 and API restart. Both applied;
API healthy, OpenRemote online. Real JWT/JWKS + PostgreSQL test passed: own site
200, foreign site 404, invalid token 401, filtered list. Synthetic data/client
removed. enrollmentEnabled=false and writesEnabled=false verified. PRs #18/#19
merged into main 57787d5. This supersedes the blocked deployment note below.
Next: SMTP and dedicated enrollment client, frontend invitation/acceptance forms
and real user login. No real email onboarding has been completed.

Собственикът изрично одобри локални миграции 003/004 и API restart. Приложени;
API healthy, OpenRemote online. Реален JWT/JWKS + PostgreSQL тест мина: собствен
обект 200, чужд 404, невалиден token 401, филтриран списък. Тестовите данни/клиент
са изтрити. Потвърдени enrollmentEnabled=false и writesEnabled=false. PR #18/#19
са merged в main 57787d5. Заменя бележката за блокирано внедряване по-долу.
Следва SMTP, отделен enrollment клиент, frontend форми и реален потребителски
вход. Реална регистрация по имейл още не е завършена.

## Enrollment checkpoint / Регистрация — 2026-09-15

Implemented database-scoped authorization and invitation backend foundation.
16 tests passed; disposable PostgreSQL lifecycle test passed with fake email.
Docker image built. NOT deployed: safety review rejected live migrations/API
restart pending explicit owner approval. Active runtime remains previous version.
Next: approve local migrations 003/004 and API restart; provision dedicated
enrollment client/SMTP and frontend forms before enabling registration.
See docs/EMAIL_ENROLLMENT.md. No real email/browser registration demonstrated.

Добавена backend основа за покани и права от базата по организация/обект.
16 теста и PostgreSQL lifecycle тест със симулиран имейл минаха. Docker image
е билднат. НЕ е внедрено: защитната проверка отказа live миграции/API restart
без изрично одобрение. Активната среда е предходната версия. Следва одобрение
за локални миграции 003/004 и API restart; отделен enrollment клиент/SMTP и
frontend форми преди активиране. Виж docs/EMAIL_ENROLLMENT.md. Няма доказана
регистрация с реален имейл/browser.

## Local portal callback fix / Корекция на локалния вход — 2026-09-14

Fixed missing loopback 4173 callbacks and API origin; applied to local staging.
Regression checks: three exact callbacks return login forms; foreign host rejected.
API health 200. Full browser login, user membership and site rights remain pending.
Next: start a fresh login from the local portal. MQTT/TLS/WireGuard are deferred.

Добавени липсващите loopback 4173 callbacks и API origin; приложени локално.
Тестове: трите точни адреса връщат login форма; чужд host е отказан.
API health 200. Пълен browser вход, membership и права по обекти предстоят.
Следва нов вход от локалния портал. MQTT/TLS/WireGuard са отложени.

## Port update / Промяна на порт — 2026-09-14

OpenRemote endpoint changed to https://localhost:8443/ at owner's request.
OIDC/forwarded headers and callback settings updated together; databases
preserved. Browser certificate/login acceptance remains pending.

OpenRemote адресът е променен на https://localhost:8443/ по искане на
собственика. OIDC/forwarded headers и callbacks са обновени заедно; базите
са запазени. Browser certificate/login приемането предстои.

## Current authoritative checkpoint / Актуално състояние — 2026-09-14

Runtime and OIDC/API tenant tests implemented on feat/macos-linux-runtime.
See docs/MAC_RUNTIME_ACCEPTANCE.md for the complete current evidence matrix.
Real own-site 200 / foreign-site 404 / invalid-token 401 passed; temporary test
data removed. Owner confirmed Portainer container view. Browser login blocked
by certificate handoff; VPN, MQTT and backup/restore remain incomplete.
Next: browser certificate handoff and PKCE login/logout; do not claim complete.
User authorized review and merge of completed changes. No production approval.

Runtime и OIDC/API tenant тестове са внедрени във feat/macos-linux-runtime.
Актуалната матрица е docs/MAC_RUNTIME_ACCEPTANCE.md. Реални свой обект 200 /
чужд 404 / невалиден token 401 са успешни; временните данни са премахнати.
Собственикът потвърди Portainer изгледа. Browser вход чака certificate handoff;
VPN, MQTT и backup/restore не са завършени. Следва сертификат и PKCE вход/изход.
Собственикът разреши review/merge на готовите промени. Без production одобрение.

## Portainer checkpoint / Portainer проверка — 2026-09-14

Portainer CE 2.45.0 installed and listening on loopback HTTPS 9443. Owner must
complete certificate warning and initial admin setup; no credentials entered
by agent. UI container list not verified. See HANDOFF.md. Next: browser login
and real tenant authorization; VPN, MQTT and restore still pending.

Portainer CE 2.45.0 е инсталиран и слуша loopback HTTPS 9443. Собственикът
обработва certificate warning и първоначалния admin setup; агентът не е въвеждал
credentials. UI списъкът не е проверен. Виж HANDOFF.md. Следва browser вход и
реална tenant авторизация; VPN, MQTT и restore още предстоят.

## OIDC progress — 2026-09-14 / OIDC напредък

Created gridex realm via OpenRemote, portal PKCE client and API service client.
Granted only read:assets; real service-token Asset query succeeded (empty realm).
Temporary bootstrap client removed. Browser login/tenant acceptance pending.
Next: synthetic test user with membership, browser PKCE login and negative API
authorization tests. Keep writes disabled. Script: scripts/provision-mac-oidc.mjs.

Създадени gridex realm през OpenRemote, portal PKCE и API service клиент.
Дадено само read:assets; реална Asset заявка с service token мина (празен realm).
Временният bootstrap клиент е изтрит. Browser вход/tenancy още не са приети.
Следва synthetic потребител с membership, PKCE вход и отрицателни API auth
тестове. Записите остават забранени. Script: scripts/provision-mac-oidc.mjs.

## Latest runtime checkpoint / Последна runtime проверка

2026-09-14: branch `feat/macos-linux-runtime`. Six healthy containers and host
API health verified; 12 API tests passed; migrations 001/002 applied. See
`docs/MAC_RUNTIME_CHECKPOINT.md` for evidence, files and ordered remaining work.
Next: provision/test OIDC clients and tenancy; then TLS and restore acceptance.
WireGuard is not configured; no Site Router peer exists. Edge read-only checks
found journal ownership errors and an ESP Modbus response timeout. Earlier
not-installed checkpoint below is historical. Runtime work is not complete.

2026-09-14: branch `feat/macos-linux-runtime`. Шест healthy контейнера, API от
host, 12 успешни API теста; миграции 001/002 приложени. Доказателства и оставащи
задачи: `docs/MAC_RUNTIME_CHECKPOINT.md`. Следва OIDC/tenancy, после TLS/restore.
WireGuard не е конфигуриран; няма Site Router peer. Read-only Edge проверката
откри грешни journal права и ESP Modbus timeout. Старото състояние по-долу е
историческо. Runtime задачата още не е завършена.

## Active checkpoint — 2026-09-14 / Активно състояние

Current task: Mac/Linux compatibility research and durable handoff. Owner stopped
Windows experiments. Baseline origin/main 279745b; branch docs/macos-linux-handoff.
Completed: host inspection, registry ARM64 checks, Colima/CLI/Compose version
research, EN/BG docs and handoff. Modified: AGENTS.md, HANDOFF.md, CODEX_STATE.md,
README.md, docs/MAC_LINUX_HANDOFF.md. Validation: documentation diff and secret/
identifier review; no runtime tests. No software installed, no VM/containers
started. 0/6 implementation milestones complete. Known issues: OIDC token
endpoint, migration execution, staging override and all runtime/restore checks
pending. Next: install/verify Colima gridex ARM64 profile and implement isolated
staging in the next task; preserve the recovery backlog below.

Текущо: проучване за Mac/Linux и траен handoff. Windows експериментите са спрени.
Основа origin/main 279745b; branch docs/macos-linux-handoff. Готови: host проверка,
ARM64 metadata, Colima/CLI/Compose версии, EN/BG документация. Променени: AGENTS.md,
HANDOFF.md, CODEX_STATE.md, README.md, docs/MAC_LINUX_HANDOFF.md. Проверки: diff и
преглед за secrets/идентификатори; без runtime тестове. Няма инсталации или старт
на VM/контейнери. 0/6 implementation етапа готови. Остават OIDC token endpoint,
миграции, staging override, runtime/restore проверки. Следва: Colima gridex ARM64
профил и изолиран staging в следващата задача; recovery backlog по-долу се запазва.

## Previous recovery checkpoint / Предходно recovery състояние

## Current task

Document the planned recovery ingestion of the ROCK Pi local telemetry journal.
No recovery-worker source code is implemented by this task.

Документирай планирания recovery ingestion на local telemetry journal-а на ROCK
Pi. С тази задача не се имплементира source code за recovery worker.

## Completed

- Added the durable, repository-specific handoff entry for the coordinated Edge
  export and backend recovery-ingestion work.

- Добавен е трайният, специфичен за repository-то handoff запис за
  координираните Edge export и backend recovery-ingestion задачи.

## Remaining

- Agree the versioned export/acknowledgement contract with the Edge repository.
- Implement the idempotent PostgreSQL ingestion worker in a separate Pull
  Request, then prove recovery without any control command.

- Договори versioned export/acknowledgement договора с Edge repository-то.
- Имплементирай idempotent PostgreSQL ingestion worker в отделен Pull Request,
  после докажи recovery без control команда.

## Modified files

- `HANDOFF.md`
- `CODEX_STATE.md`
- `docs/integration-flow.md`
- `docs/TELEMETRY_JOURNAL_RECOVERY_V1.md`

## Tests

- Documentation-only change; `git diff --check` passed.

## Known issues

- No export, acknowledgement, replay or backend recovery worker exists yet.

## Next action

Create the coordinated Edge and backend implementation Pull Requests only after
the versioned record identity and acknowledgement contract are approved.

Създай координираните Edge и backend implementation Pull Request-и едва след
одобрение на versioned record identity и acknowledgement договора.

## Last updated

2026-09-13
