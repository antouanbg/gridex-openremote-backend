# CODEX_STATE.md

## Mailgun live API test / Реален Mailgun API тест — 2026-09-19

Replacement key and approved sending settings now read from the single private
backend `.env`. Provider test mode accepted the request and returned a message
ID. No real delivery; next: one explicitly requested delivery test, container
configuration consolidation and Keycloak email integration. No secret logged.

Замененият ключ и одобрените sending настройки се четат от единния частен
backend `.env`. Provider test mode прие заявката и върна message ID. Без реална
доставка; следва изрично поискан единичен delivery тест, обединяване на container
конфигурацията и Keycloak email интеграция. Няма записани тайни в логовете.

## Single configuration rule / Правило за една конфигурация — 2026-09-19

Recorded owner requirement in AGENTS.md and HANDOFF.md: one private backend
`.env`, no independently maintained service env files/Keychain settings.
Documentation only; current split runtime files still need consolidation and
Compose/test invocation updates. No secrets included or runtime changed.

Записано изискването на собственика в AGENTS.md и HANDOFF.md: един частен
backend `.env`, без самостоятелни service env/Keychain настройки. Само
документация; разделените runtime файлове още изискват обединяване и обновяване
на Compose/test командите. Без включени тайни или runtime промени.

## Mailgun API preparation / Mailgun API подготовка — 2026-09-19

Internal REST transport and Keychain-backed test CLI prepared; no arbitrary
public send endpoint. Mock tests verify region, test mode, tracking and errors.
Live test blocked by disclosed-key persistence denial. Next: replacement key,
provider test mode, DNS acceptance, one owner test and Keycloak email adapter.

Подготвени вътрешен REST транспорт и CLI с Keychain; без произволен публичен
send endpoint. Mock тестовете проверяват регион, test mode, tracking и грешки.
Реален тест е блокиран от отказа за запис на публикувания ключ. Следва заменен
ключ, provider test mode, DNS проверка, един owner тест и Keycloak email адаптер.

## Public auth transition / Публичен auth преход — 2026-09-18

Applied locally: public Keycloak hostname/proxy headers and matching API issuer/
CORS origin. Keycloak and API recreated cleanly and became healthy. Discovery
from the API network reports `https://auth.gridex.tech/auth/realms/gridex`.
The public restricted proxy/API ingress was independently reached over HTTPS;
only its permitted API/auth paths are public. Frontend source now starts OIDC
without a public health preflight and uses the public auth issuer.

Applied and verified: the interactive exact callback allow-list script completed
with the owner's Keycloak password; root, English and silent-SSO callbacks show
the login form, while a foreign callback is rejected. Still pending: browser
PKCE login/logout with a normal Gridex user, tenant/site authorization
acceptance, and frontend publication. The callback rollback snapshot is private
and the helper never emits the password.

Приложено локално: публично Keycloak hostname/proxy headers и съвпадащ API
issuer/CORS origin. Keycloak и API бяха пресъздадени чисто и са healthy.
Discovery от API мрежата отчита `https://auth.gridex.tech/auth/realms/gridex`.
Ограниченият public proxy/API ingress е достигнат независимо през HTTPS; публични
са само разрешените API/auth пътища. Frontend source стартира OIDC без public
health preflight и ползва публичния auth issuer.

Приложено и проверено: интерактивният скрипт за точния callback allow-list
завърши с Keycloak паролата на собственика; root, English и silent-SSO callbacks
показват login форма, а чужд callback се отказва. Предстоят browser PKCE
вход/изход с обикновен Gridex user, tenant/site authorization acceptance и
публикация на frontend. Callback rollback snapshot е частен и инструментът
никога не извежда паролата.

## Handoff consolidation / Обобщен handoff — 2026-09-16

Documentation-only: HANDOFF.md now contains six ordered remaining milestones,
owners, acceptance gates, certificate expiry/manual-renewal warning and exact
next action (private OIDC inspection, backup, configuration and local login QA).
Historical notes retained but superseded by its current queue. No runtime changes.
Validation: EN/BG semantic review, git diff --check; no runtime tests for this edit.

Само документация: HANDOFF.md съдържа шест подредени оставащи етапа, отговорници,
приемателни условия, срок/ръчно подновяване и точно следващо (частен OIDC преглед,
backup, настройки и локален login QA). Старите бележки са запазени като исторически.
Без runtime промени. Проверки: EN/BG смисъл и git diff --check; без runtime тестове.

## Trusted TLS installed / Доверен TLS инсталиран — 2026-09-16

Let's Encrypt DNS-01 succeeded for both approved API/auth hosts. Certificate
expires 2026-12-15; installed in private loopback proxy runtime, replacing TEST
certificate (backup retained). nginx -t and 8 route tests passed with normal
curl trust, no -k/custom CA. No public bind/router change. Keys remain outside Git.
MANUAL renewal only: no DNS hook configured; renewed files must also be copied
to proxy certs and nginx validated/reloaded. Next: OIDC hostname/API issuer,
frontend readiness and full login QA before public 443 activation.

Let's Encrypt DNS-01 мина за одобрените API/auth домейни. Сертификатът изтича
на 2026-12-15 и е поставен в частната loopback proxy среда вместо TEST сертификата
(запазен backup). nginx -t и 8 route теста минаха с нормално curl доверие, без
-k/частен CA. Няма public bind/рутер промяна. Ключовете са извън Git.
Подновяването е РЪЧНО, няма DNS hook; след него сертификатите трябва да се копират
и nginx да се провери/reload-не. Следва OIDC hostname/API issuer, frontend
readiness и пълен login QA преди публичен 443.

## HTTPS local verification / Локална HTTPS проверка — 2026-09-15

Restricted nginx running on loopback 14443 with private 7-day TEST certificate.
nginx -t passed; verified TLS with explicit certificate trust (no -k).
API me without token 401, gridex discovery 200, health/metrics/admin/master/
manager/traversal paths 404. Fixed tmpfs YAML quoting and read-only temp paths.
Public certificate NOT issued: awaiting owner's ACME email, then DNS TXT proof.
Next: ACME DNS-01, trusted cert installation and OIDC hostname commissioning.
No router ports, WireGuard, system trust store or existing services changed.

Ограничен nginx работи на loopback 14443 с частен 7-дневен ТЕСТОВ сертификат.
nginx -t мина; TLS проверен с изрично доверие към сертификата, без -k.
API me без token 401, gridex discovery 200; health/metrics/admin/master/manager/
traversal 404. Поправени tmpfs YAML и readonly temp paths. Публичен сертификат
НЕ е издаден: чакаме ACME имейл, после DNS TXT. Следва DNS-01, доверен сертификат
и OIDC hostname. Без промени по рутер, VPN, system trust или други услуги.

## Reboot recovery / Възстановяване след рестарт — 2026-09-15

Colima gridex restarted; existing backend containers recovered automatically.
Public api/auth DNS now resolves to the owner-confirmed address. Added user
LaunchAgent deploy/macos/tech.gridex.colima.plist for login startup; no root boot
service or automatic login. Reboot test pending. Next: TLS certificates and
restricted ingress commissioning; WireGuard remains disabled.

Colima gridex е стартиран; съществуващите backend контейнери се възстановиха.
Публичните api/auth DNS вече сочат към потвърдения адрес. Добавен потребителски
LaunchAgent deploy/macos/tech.gridex.colima.plist за старт при вход, не root boot
услуга/автоматичен login. Реален reboot тест предстои. Следва TLS/ограничен ingress;
WireGuard остава изключен.

## Public HTTPS / Публичен HTTPS — 2026-09-15

Current task: public API/auth ingress and GitHub Pages live login. Prepared
deploy/public-https templates and docs/PUBLIC_HTTPS_HANDOFF.md. Not deployed:
Colima stopped, DNS records absent, no public certificate/runtime test. Compose
schema and diff checks only. Next: restore runtime and obtain DNS/certificates,
then follow handoff before frontend publication. WireGuard remains inactive.

Задача: публичен API/auth и GitHub Pages live вход. Подготвени
deploy/public-https и docs/PUBLIC_HTTPS_HANDOFF.md. Не е внедрено: спрян Colima,
липсващи DNS записи/сертификат/runtime тест. Само Compose schema/diff проверки.
Следва runtime, DNS/сертификати и handoff преди frontend публикация. VPN е изключен.

## WireGuard preparation / WireGuard подготовка — 2026-09-15

Prepared dormant Compose scaffold, hub/router templates and bilingual selective
network plan in docs/WIREGUARD_ISOLATION_PREPARED.md. No runtime/network changes.
Activation intentionally blocked; kernel/image/UDP/firewall/relay tests pending.
Next action: wait for owner relocation confirmation and activation approval,
then perform the documented preflight. MQTT PR #22 is the parent dependency.

Подготвени неактивен Compose, hub/router шаблони и двуезичен план в
docs/WIREGUARD_ISOLATION_PREPARED.md. Без runtime/мрежови промени. Активирането
е блокирано; kernel/image/UDP/firewall/TCP тестове предстоят. Следва: потвърждение
за преместване и разрешение за активиране, после описаните проверки. Основа: PR #22.

## MQTT checkpoint / MQTT състояние — 2026-09-15

Implemented and deployed the isolated local Mosquitto mTLS stack. See
docs/MQTT_TLS_LOCAL.md. Per-site certificate identities and exact topic ACLs;
persistent data, restart policy, healthcheck and bounded container logs.
Live synthetic tests passed: trusted delivery, missing certificate/hostname
rejection, cross-site read/write denial, command denial and retained delivery
after broker restart. Fixed CA keyUsage for strict TLS validation. No secrets
or real inventory in Git. API/database and hardware were not changed here.
Next: enroll real gateway identities securely, establish Site Router VPN-only
access, then implement/test ingestion into PostgreSQL/OpenRemote. Broker tests
do NOT prove real device delivery or database ingestion. Earlier entries below
are historical checkpoints, not a fresh runtime audit.

Изолираният локален Mosquitto mTLS е реализиран и внедрен. Виж
docs/MQTT_TLS_LOCAL.md. Отделни сертификати и точни topic ACL по обект;
постоянни данни, restart policy, healthcheck и ограничени контейнерни логове.
Реални синтетични тестове минаха: доставка, отказ при липсващ сертификат/грешно
hostname, забрана за чуждо четене/запис и команди, retained доставка след
рестарт. Поправен CA keyUsage за строг TLS валидатор. Няма secrets или реален
inventory в Git. API/базата и хардуерът не са променяни в тази задача.
Следва: сигурно добавяне на реални gateway идентичности, достъп само през Site
Router VPN, после ingestion към PostgreSQL/OpenRemote. Broker тестът НЕ доказва
реална телеметрия или запис в базата. По-долните записи са исторически.

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
