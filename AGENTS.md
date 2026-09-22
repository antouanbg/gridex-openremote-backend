# GrideX OpenRemote backend — Working rules

## Scoped public Manager exception / Ограничено изключение за публичен Manager — 2026-09-22

Owner selected the existing public auth origin + `/manager/?realm=gridex` for
external Manager access, sharing HTTPS 443 and its certificate, not a new `or`
hostname. This supersedes the browser-to-GrideX-API-only restriction solely for
authenticated Manager use and its reviewed required API/WebSocket paths.
No catch-all upstream exposure; retain asset/realm permissions and block public
master, Keycloak admin, health and metrics. Preserve local master/public gridex
issuer separation and the mandatory auth regression gate. Follow HANDOFF's
2026-09-22 implementation/acceptance checklist. Approval is not deployment.

Собственикът избра текущия публичен auth адрес + `/manager/?realm=gridex` за
външен Manager достъп със същите HTTPS 443 и сертификат, не нов `or` hostname.
Това отменя ограничението browser само към GrideX API единствено за автентикиран
Manager и проверените му необходими API/WebSocket маршрути. Без общо излагане
на upstream; запази asset/realm правата и блокирай публични master, Keycloak
admin, health и metrics. Пази local master/public gridex issuer разделението
и задължителната auth проверка. Следвай списъка за реализация/приемане от
2026-09-22 в HANDOFF. Одобрение не означава внедряване.

## Strategic invariant: OpenRemote-only inventory / Стратегическо правило — 2026-09-20

Owner-confirmed: OpenRemote is the ONLY authoritative place for all operational
inventory, Sites, devices, gateways, sensors and resource relationships. This
applies equally to user actions through the frontend and Codex/operator actions
under owner instructions: create/provision/update resources through supported
OpenRemote APIs, normally orchestrated by the authorized GrideX backend. Never
bypass OpenRemote by SQL, import, scripts, browser storage or a second registry.
Do not expose administrative credentials in the frontend. No local-only resource
may be presented as provisioned. Require verified OR identity, hierarchy,
owner/realm access and durable bindings before success; outages and partial
failures stay pending/failed and must reconcile idempotently.
Local drafts, delivery queues and disposable read projections are allowed ONLY
as workflow data referencing OR or a pending request, never independent inventory.
Device configuration/NVS and certificates are execution artifacts, not a registry.
Keycloak identity and business records are separate concerns. Anonymous demo
fixtures remain explicitly synthetic, never registered customer/live inventory.
This decision supersedes conflicting older local-only provisioning instructions.
Preserve existing data and safety locks; reconcile legacy orphans with backup,
not blind deletion. Canonical plan: backend docs/OPENREMOTE_PROVISIONING_AUTHORITY.md.
Documentation is not runtime enforcement; migration and acceptance remain pending.

Потвърдено от собственика: OpenRemote е ЕДИНСТВЕНОТО основно място за целия
оперативен инвентар, Обекти, устройства, шлюзове, сензори и ресурсните им връзки.
Правилото важи еднакво за потребителя през frontend и за Codex/оператор по
инструкции на собственика: създаване/провизиране/обновяване през поддържаните
OpenRemote API, обичайно чрез GrideX backend с проверени права. Без заобикаляне
чрез SQL, import, скриптове, browser storage или втори регистър. Без admin тайни
във frontend. Local-only ресурс не се показва като провизиран. Успех изисква
проверени OR идентичност, йерархия, собственик/realm права и устойчив binding;
отказите остават pending/failed и се съгласуват идемпотентно.
Локални чернови, опашки и възстановими проекции за четене са допустими САМО като
данни за процеса с връзка към OR или чакаща заявка, никога независим инвентар.
Device конфигурации/NVS и сертификати са изпълними настройки, не регистър.
Keycloak идентичности и бизнес записи са отделни. Анонимното демо остава ясно
синтетично, не регистриран клиентски/live инвентар.
Решението отменя противоречащи стари инструкции за local-only provisioning.
Пази данните и safety locks; съгласувай наследените записи с backup, без сляпо
изтриване. Каноничен план: backend docs/OPENREMOTE_PROVISIONING_AUTHORITY.md.
Документацията не е runtime защита; миграцията и приемането предстоят.


## OpenRemote provisioning authority — mandatory / Задължително — 2026-09-20

OpenRemote is the authoritative registry for Sites, ROCK/ESP gateways and nodes,
meters, inverters, batteries, chargers, sensors and their asset relationships.
Provision through GrideX UI/API orchestration of supported OpenRemote APIs;
never create an independent active inventory in another database or bypass
OpenRemote with bootstrap/import scripts. Do not write OpenRemote asset tables
directly. A local draft/pending intent is allowed, but configured/provisioned
success requires verified asset existence, realm, parent/Site, owner access and
a durable local-to-OpenRemote binding. Heartbeat receipt is not provisioning.
Missing/unavailable OpenRemote means pending/failed/reconciliation required,
never a successful local-only fallback. Updates must also reconcile both sides.
Use idempotency and recovery after partial failures; do not blindly delete
assets on retries. Keycloak identity, business records, scoped permissions,
invitations, drafts, audit and transport outboxes may remain outside OpenRemote;
they are not a second operational resource registry. Keep measurement history
in existing OpenRemote TimescaleDB and preserve commissioning/control locks.
Isolated test fixtures are not a production provisioning path. Existing orphan
records are migration debt: preserve data, ownership, keys and history until an
approved, backed-up reconciliation. Before marking work complete, test outages,
retries, partial failures, cross-owner denial and matching UI/OR resource trees.
See docs/OPENREMOTE_PROVISIONING_AUTHORITY.md. This rule is a requirement, not
evidence that existing code or runtime has already been corrected.

OpenRemote е основният регистър за Обекти, ROCK/ESP шлюзове и възли, метри,
инвертори, батерии, зарядни, сензори и връзките между техните assets. GrideX
UI/API организира provisioning през поддържаните OpenRemote API; забранен е
втори независим активен инвентар в друга база, включително чрез bootstrap/import
скриптове. Без директни записи в OpenRemote asset таблици. Допуска се локална
чернова/чакаща заявка, но успех configured/provisioned изисква проверени asset,
realm, родител/Обект, достъп на собственика и устойчива връзка към локалния запис.
Heartbeat не доказва provisioning. При липсващ/недостъпен OpenRemote статусът
е pending/failed/reconciliation required, не успешен local-only fallback.
Обновяванията също трябва да съгласуват двете страни. Изисквай идемпотентност и
възстановяване след частичен отказ; без сляпо изтриване при повторен опит.
Keycloak идентичности, бизнес записи, ограничени права, покани, чернови, audit
и transport outbox могат да са извън OpenRemote, но не като втори ресурсен
регистър. Историята остава в наличната OpenRemote TimescaleDB; commissioning/
control locks се пазят. Изолираните тестови fixtures не са production път.
Съществуващите несвързани записи са миграционен дълг: пази данни, собственост,
ключове и история до одобрено съгласуване с backup. Преди приключване тествай
откази, повторения, частични грешки, забрана за чужд собственик и еднакви дървета
в UI/OR. Виж docs/OPENREMOTE_PROVISIONING_AUTHORITY.md. Правилото не доказва,
че текущият код или runtime вече са поправени.

## Historical measurements / Исторически измервания — 2026-09-20

Manager 1.30.0 pilot uses the pinned services/openremote-issuer image patch.
Preserve local master and public gridex issuer separation. Rebuild its signed-JWT
regression test on upgrades; never replace it with disabled issuer validation.
Manager 1.30.0 pilot използва pinned services/openremote-issuer patch. Пази
local master/public gridex разделението; при upgrade изпълни signed-JWT
regression теста. Никога не го заменяй с изключена issuer проверка.

Use existing OpenRemote TimescaleDB for historical measurements from meters,
inverters, batteries, chargers and other provisioned sensors. Per-device metric
selection, measurement, publication and heartbeat periods must remain distinct;
never impose a global 15-minute interval. Preserve unknown values as null.
Keep current heartbeat state separate from measurement history. Record desired
profiles separately from edge acknowledgement. Follow
docs/TIMESCALE_DEVICE_HISTORY.md, including its open runtime acceptance gates.
No second time-series service by default, no issuer-validation bypass, no
master credentials in ingestion workers. Two years included is the commercial
policy; do not enable deletion before export/paid retention/restore safeguards.
All operator settings use the single backend env. Tests and live evidence,
not the presence of the extension or MQTT heartbeat alone, establish completion.

Историята от метри, инвертори, батерии, зарядни и други заведени сензори е в
съществуващата OpenRemote TimescaleDB. Показателите и периодите за измерване,
публикуване и heartbeat са отделни по устройство; без общи 15 минути.
Неизвестните стойности са null. Текущ heartbeat не е история от измервания;
желан профил не е edge потвърждение. Следвай docs/TIMESCALE_DEVICE_HISTORY.md
и незавършените runtime проверки. Без втора time-series услуга по подразбиране,
без изключена issuer проверка или master credentials в worker. Две години са
включени по бизнес политика; без изтриване преди export/paid retention/restore
защити. Един backend env. Приключване доказват тестове и реални измервания,
не само налична extension или получен MQTT heartbeat.

## Approved per-Site transports / Одобрени транспорти по Обект — 2026-09-19

Owner explicitly approves implementation and publication of both selectable
modes: wireguard_private (ROCK → Site Router → VPN → MQTT) and mqtt_mtls_direct
(ROCK → Internet → controlled MQTT mTLS ingress). This supersedes older blanket
VPN-only/public-MQTT prohibitions for that scoped ingress only. Same identity,
topic ACLs, telemetry/heartbeat contract and Site permissions in both modes.
One active mode per ROCK; no automatic downgrade. Router remains the VPN peer;
ESP/OT/admin/DB remain non-public. No SSH dependency for the intended enrolment
or OTA process. Follow the canonical backend plan
[PER_SITE_TRANSPORT_AND_ENROLLMENT](https://github.com/antouanbg/gridex-openremote-backend/blob/docs/per-site-transport/docs/PER_SITE_TRANSPORT_AND_ENROLLMENT.md).
Do not confuse approval or Git publication with deployed, tested connectivity.
Activation follows its security and commissioning gates; preserve control locks.
UI selection belongs inside existing Site/Devices settings, not a new menu item.

Собственикът изрично одобрява реализация и публикуване на избираемите режими
wireguard_private (ROCK → рутер → VPN → MQTT) и mqtt_mtls_direct (ROCK → Интернет
→ контролиран MQTT mTLS вход). Старите общи VPN-only/public-MQTT забрани се
отменят само за този ограничен вход. Идентичност, topic ACL, heartbeat/telemetry
договор и Site права са еднакви. Един активен режим на ROCK, без автоматичен
downgrade. VPN peer остава рутерът; ESP/OT/admin/DB не стават публични. Целевият
provisioning/OTA процес не зависи от SSH. Следвай каноничния backend план по-горе.
Одобрение/Git публикация не означават внедрена/тествана връзка. Активиране след
security/commissioning gates; control locks се пазят. Изборът е вътре в текущите
настройки Обект/Устройства, не ново меню.


## Mandatory auth regression gate / Задължителна auth проверка

After proxy, Keycloak, OIDC, frontend login changes or restart: verify local
master discovery, admin console authServerUrl and a fresh login form all stay
on the configured local admin origin; verify public gridex issuer/callbacks
remain public, and master/admin/health/metrics stay blocked at public ingress.
Run backend scripts/check-auth-routing.mjs with the single private backend env.
Normal-DNS trusted-TLS probes and forced local/LAN probes are different evidence;
never claim external reachability from a local probe. Read the actual router
destination port before testing; do not assume host port 443.
HTTP 200 for a shell/form is NOT completed login. Require browser login,
logout and fresh login after session expiry before declaring authentication
accepted. Record untested steps, failures, rollback and deployment revision in
HANDOFF. Never weaken CORS/TLS or expose master to repair login. Do not print
passwords, tokens or session/action URLs. This gate is not a running monitor.

След proxy, Keycloak, OIDC, frontend login промени или рестарт: провери local
master discovery, authServerUrl на admin конзолата и нова login форма — всички
към конфигурирания локален admin адрес. Public gridex issuer/callbacks остават
публични, а master/admin/health/metrics — забранени на публичния ingress.
Изпълни backend scripts/check-auth-routing.mjs с единния частен backend env.
Normal-DNS/trusted-TLS и принудителните local/LAN проби са различни доказателства;
локален успех не доказва външен достъп. Чети реалния целеви порт на рутера,
не приемай host 443. HTTP 200 на shell/форма НЕ е завършен вход. Изисквай browser
вход, изход и нов вход след изтекла сесия преди приемане. Записвай непроверените
стъпки, грешки, rollback и deployment ревизия в HANDOFF. Не отслабвай CORS/TLS
и не излагай master за поправка. Без пароли, токени и session/action URL в логове.
Това е проверка при промени, не работещ постоянен монитор.

## One backend configuration file — mandatory / Един backend конфигурационен файл — задължително

Owner decision 2026-09-19: use exactly one operator-maintained configuration
file per backend deployment: `~/GrideX-runtime/backend/.env` on the current Mac.
All backend settings, including OIDC, Mailgun, database settings and application
credentials, belong there. Keep it outside Git/synced folders, mode 0600, and
never print or commit its secret values. Commit only sanitized examples.
Do not introduce additional service `.env` files, layered env-file overrides,
or a separate Keychain configuration as a second source of settings. Compose
and setup/test scripts must read the same file and pass only necessary values
to each service; never inject all backend secrets into every container.
Compose manifests, generated service files and referenced certificate/key
artifacts may exist, but must not become independently maintained copies of
backend settings. Any future deviation requires the owner's explicit approval.
Existing `public-oidc.env` and `mailgun.env` are migration debt: consolidate and
verify effective settings before retiring them. Documentation does not prove
that consolidation or deployment has happened.

Решение на собственика от 2026-09-19: точно един поддържан от оператора
конфигурационен файл за всяко backend внедряване: `~/GrideX-runtime/backend/.env`
на текущия Mac. Всички backend настройки, включително OIDC, Mailgun, бази и
application credentials, са в него. Файлът е извън Git/синхронизирани папки,
с права 0600; тайните стойности не се отпечатват и не се commit-ват. В Git
се пазят само обезличени примери. Не създавай допълнителни service `.env`
файлове, наслагвани env-file overrides или отделна Keychain конфигурация като
втори източник на настройки. Compose и setup/test скриптовете четат същия файл
и подават само нужните стойности на всяка услуга; не подавай всички backend
тайни на всеки контейнер. Compose manifests, генерирани service файлове и
реферирани сертификати/ключове могат да съществуват, но не като самостоятелно
поддържани копия на backend настройки. Бъдещо отклонение изисква изрично
одобрение от собственика. Съществуващите `public-oidc.env` и `mailgun.env`
трябва да се обединят и ефективните настройки да се проверят преди изваждането
им от употреба. Документацията не доказва извършено обединяване или внедряване.

## Architecture and security

2026-09-15: WireGuard is PREPARATION ONLY until the owner confirms ROCK Pi
relocation and explicitly approves activation. Do not start VPN/relay resources,
open ports or alter Mac routes. Follow docs/WIREGUARD_ISOLATION_PREPARED.md.
Only selected MQTT/approved future OTA communication belongs behind VPN;
do not route the whole backend through it.

2026-09-15: WireGuard е САМО ПОДГОТОВКА до потвърдено преместване на ROCK Pi
и изрично разрешение за активиране. Не стартирай VPN/TCP ресурси, не отваряй
портове и не променяй Mac маршрути. Следвай docs/WIREGUARD_ISOLATION_PREPARED.md.
Само MQTT/бъдеща одобрена OTA комуникация минава през VPN, не целият backend.

Owner decision, 2026-09-14: Windows experiments are stopped. The active backend
development/staging target is Linux ARM64 under macOS using Colima and Docker
Engine. Follow `docs/MAC_LINUX_HANDOFF.md`. Earlier Windows 11 production plans
are historical context, not an instruction to resume Windows deployment. Final
production commissioning remains pending. Keep the Site Router VPN and ownership
boundaries below unchanged. Do not resume PR #10–#13's Windows/cloud execution
paths without a new owner request.

Решение на собственика от 2026-09-14: Windows експериментите спират. Активната
backend development/staging среда е Linux ARM64 под macOS с Colima и Docker
Engine. Следвай `docs/MAC_LINUX_HANDOFF.md`. Предходните Windows 11 production
планове са исторически контекст, не указание за продължаване на Windows deployment.
Production commissioning предстои; запазват се Site Router VPN и границите на
отговорност. Windows/cloud изпълнението от PR #10–#13 не продължава без ново искане.

The central backend hosts Docker services, GrideX API, PostgreSQL,
OpenRemote, Keycloak and private MQTT ingestion. Each Site Router terminates
its own WireGuard peer; ROCK Pi and ESP nodes are behind the router. Browser
clients reach only GrideX API; OpenRemote owns live Assets and rules, while
Edge owns vendor protocols and safety. Never commit or log secrets, customer
inventory, real addresses or VPN ranges.

## Bilingual documentation — mandatory

For every user-facing, architecture, API-contract, security, operational or
deployment text:

1. English is canonical and Bulgarian is the matching section.
2. Change both language versions in the same commit whenever meaning changes.
3. Keep API fields, data paths, configuration defaults, units, safety gates and
   responsibility boundaries semantically identical.
4. Preserve project terminology: `Site = Обект`, `Edge gateway = Edge шлюз`,
   `self-consumption = собствено потребление`, and `Flexible loads = Управляеми
   товари`.
5. Do not translate identifiers, protocol names, Docker keys, API paths or
   product brands.

Before committing, compare the EN/BG sections and correct any mismatch rather
than leaving a stale translation.

## Task recovery

Read this file, `CODEX_STATE.md` and `HANDOFF.md` when present, then inspect
repository state. Every `HANDOFF.md` must identify its repository directly
under the title as `Repository / GitHub: <owner>/<repository>` and be updated
for every incomplete, untested, deployment-blocked or commissioning-blocked
item.
