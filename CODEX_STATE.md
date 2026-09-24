# CODEX_STATE.md

## All-event email opt-in / Включване на мейли за всички събития — 2026-09-24

EN: Owner clarified one persistent per-user opt-in for ALL future event types,
off by default. Only heartbeat outage events are wired today; future producers
must use the same consent and access checks. Implemented general
`/api/v1/me/email-notifications` endpoint, verified-email subscription,
per-user/incident delivery deduplication and OpenRemote link check. Additive
migrations 010/011 were applied after private backups. No subscriptions or
mail exist yet. API/worker running; deploy general endpoint revision next, then publish frontend checkbox,
verify real session and outage. See HANDOFF.

BG: Собственикът уточни един постоянен opt-in за ВСИЧКИ бъдещи видове събития,
изключен по подразбиране. Засега реално е свързан само heartbeat; бъдещите
източници трябва да ползват същото съгласие и проверки. Реализирани са общ endpoint
за потвърден имейл, deduplication по човек/инцидент и OpenRemote link проверка.
Миграции 010/011 са приложени след частни архиви. Няма абонаменти или мейли.
API/worker работят; следва внедряване на общия endpoint, публикация на checkbox
и реален тест. Виж HANDOFF.

## Six ROCK system metrics verified / Шест ROCK показателя потвърдени — 2026-09-24

Supersedes the five-metric/CPU-pending entry below. Fresh physical ROCK CPU
temperature is stored in OpenRemote TimescaleDB; a separate OpenRemote API
read returned 21 points/hour and latest 52.083 °C at check. All six system
metrics now traverse MQTT/backend/history. Frontend PR #42 is publicly
deployed, but owner-browser rendering and cross-owner denial are unverified.
No control or MODBUS writes were enabled.

Заменя по-стария статус за пет показателя/чакаща CPU стойност. Прясна CPU
температура от физическия ROCK е записана в OpenRemote TimescaleDB; отделна
OpenRemote API заявка върна 21 точки/час и последна 52.083 °C при проверката.
И шестте показателя минават през MQTT/backend/history. Frontend PR #42 е
публикуван, но показването при owner вход и отказът за чужд собственик не са
проверени. Без активирани control или MODBUS записи.

## ROCK live history status / Статус на реалната история — 2026-09-24

Five physical ROCK system metrics are reaching the existing OpenRemote
Timescale datapoint table through MQTT and the backend outbox; repeated
read-only counts increased from 15 to 24 each. Missing restricted history-
writer links on five new OpenRemote Assets caused 403 retries; repaired via
OpenRemote API with validated private backup `rock-history-writer-OSimep`.
Provisioning now verifies/grants those links and preserves other Sites'
bindings. CPU temperature has no live datapoints yet. External authenticated
Devices UI and longer runtime stability are unverified. See HANDOFF top entry.

Пет реални ROCK системни показателя вече стигат до OpenRemote Timescale през
MQTT и backend outbox; броят им нарасна от 15 до 24. Липсващите връзки на пет
Assets към ограничения writer причиняваха 403; поправени през OpenRemote API
с проверен частен backup `rock-history-writer-OSimep`. Provisioning вече ги
проверява и пази binding-ите на другите Обекти. CPU температура още няма
реални записи. Външният потребителски UI и дълга стабилност не са потвърдени.

## ROCK system telemetry implementation prepared / Подготвена системна телеметрия — 2026-09-23

Backend now validates an allowlisted `/system/telemetry` MQTT contract, relays
accepted samples through the durable outbox to OpenRemote datapoints, and exposes
authorized `GET /api/v1/sites/{siteId}/history` for the Devices UI. ROCK Pi image
code can publish CPU temperature, uptime, load1, available memory, data free
space and journal size; it is gated by `GRIDEX_SYSTEM_TELEMETRY_ENABLED=0` in the
example configuration and does not change control/MODBUS or Ethernet. Frontend
Devices shows the latest OpenRemote-recorded values without Grafana. Physical
activation, asset bindings and real-data acceptance remain a deployment gate.

Подготвена е allowlist MQTT `/system/telemetry`, устойчив relay към OpenRemote
datapoints и защитен history API за „Устройства“. ROCK Pi може да изпраща CPU
температура, uptime, load1, свободна RAM, свободно пространство и journal size;
примерът е изключен до провизиране и не променя control/MODBUS/Ethernet. GrideX
показва последните записани стойности без Grafana. Физическото включване,
binding-ите и приемането с реални данни остават deployment gate.

## External Manager runtime update / Runtime външен Manager — 2026-09-22

Scoped public-auth `/manager/` proxy + existing openremote client callbacks
applied; rollback public-manager-V36M4o. Read-oriented REST surface, no new roles.
Three generator tests/local TLS route tests/local master gate pass. The canonical
nginx template now retains the Manager surface for future deployments. Owner
confirmed external Manager works; authenticated assets/WebSocket/session and
cross-owner evidence remain separate acceptance work. Two synthetic master bootstrap JSON responses
are not master upstream exposure. Preserve runtime overlay during future proxy
deployment; integration into normal renderer pending. See newest HANDOFF entry.

Приложени са ограниченият public-auth `/manager/` proxy и callbacks за openremote;
rollback public-manager-V36M4o. REST за преглед, без нови роли. Трите generator
теста/local TLS маршрути/local master проверка минаха. Каноничният nginx template
вече запазва Manager повърхността при бъдещи deployments. Собственикът потвърди,
че външният Manager работи; отделните assets/WebSocket/session и cross-owner
доказателства предстоят. Двата синтетични master bootstrap JSON не излагат
master upstream. Виж най-новия HANDOFF запис.

## External Manager decision / Решение за външен Manager — 2026-09-22

Approved: existing public auth origin + `/manager/?realm=gridex`, existing
certificate/443; replaces the separate `or` hostname proposal. Documentation only,
not deployed/tested. Next: inspect Manager paths, prepare a minimal proxy allowlist
and scoped OIDC callbacks, then security and real external browser acceptance.
Preserve local master, public gridex issuer, asset permissions and private admin/
health/metrics. See the dated external Manager entry in HANDOFF.md; do not mark
the URL active or introduce a new DNS/certificate requirement for this approach.

Одобрено: текущият публичен auth адрес + `/manager/?realm=gridex`, съществуващи
сертификат/443; заменя предложението за отделен `or` hostname. Само документация,
без внедряване/тестове. Следват проверка на Manager маршрутите, минимален proxy
allowlist и ограничени OIDC callbacks, security и реално външно browser приемане.
Пази local master, public gridex issuer, asset правата и непубличните admin/
health/metrics. Виж записа за външен Manager в HANDOFF.md; не обявявай URL за
активен и не въвеждай ново изискване за DNS/сертификат за този подход.

## Publication confirmed / Публикация потвърдена — 2026-09-20

Owner approved PR #40 merge; merged as bdefa64c283d37ba25f500d191af2ecfb52ea7d2.
Frontend quality passed on reviewed head db8a5c1. Main Pages run 35536017627
SUCCEEDED. Public release.json and /devices/ HTML both return bdefa64, including
main-AwkwdVhj.js. This supersedes the branch-protection blocker below; protections
were not changed. Backend PR #32 remains separate, not merged by this approval.
No new runtime/auth/device changes this turn. Owner's real authenticated browser
acceptance and physical temperature remain unverified; do not equate public
bundle verification with a completed personal login/device telemetry test.

Собственикът одобри merge на PR #40; слят е като bdefa64c283d37ba25f500d191af2ecfb52ea7d2.
Frontend quality мина за проверения head db8a5c1. Main Pages run 35536017627 е
УСПЕШЕН. Публичните release.json и /devices/ HTML връщат bdefa64 и bundle
main-AwkwdVhj.js. Това отменя публикационния блокер по-долу; защитите са запазени.
Backend PR #32 е отделен и не е сливан с това одобрение. Без нови runtime/auth/
device промени в този ход. Реалното owner browser приемане и физическата
температура още не са потвърдени; публичен bundle не доказва личен вход/телеметрия.


## Publication gate / Публикационен блокер — 2026-09-20

Backend a58aebf is pushed in PR #32 and deployed (381dee9a89bb); existing frontend
already receives OR-backed /sites and /hardware without requiring a new bundle.
Frontend 38295b4 is pushed in PR #40. Pages run 35535292127 built successfully
but environment protection REJECTED deployment from feat/routes-session-restoration.
No protection settings changed; no merge performed. New frontend validation/error
messages are NOT public yet. Need owner merge approval for PR #40, then verify
main Pages deployment and public revision. Real owner browser acceptance pending.

Backend a58aebf е в PR #32 и е внедрен (381dee9a89bb); текущият frontend вече
получава OR данни от /sites и /hardware и без нов bundle.
Frontend 38295b4 е в PR #40. Pages run 35535292127 build мина, но environment
защитата ОТКАЗА deployment от feat/routes-session-restoration. Защитата не е
променяна; няма merge. Новите frontend проверки/съобщения още НЕ са публични.
Нужно е owner одобрение за merge на PR #40, после проверка на main Pages
deployment и публичната ревизия. Реалното owner browser приемане предстои.


## OpenRemote-backed frontend inventory / Инвентар за frontend от OpenRemote — 2026-09-20

API DEPLOYED image 381dee9a89bb, private rollback api-inventory-8YeBtP.
GET /sites intersects current GrideX membership with OR user-linked Site assets;
names come from OR. GET /hardware verifies Site/gateway bindings, realm, parent
hierarchy and user-linked assets on every request; gateway name/model/role come
from OR. Local port/configuration data remain execution settings only.
No OR response -> 503; incomplete binding/ownership -> 409; no local-only fallback.
Existing heartbeat transport and configuration editing are unchanged.
Actual owner membership/OR data handler probe returns one accessible pilot and
two verified gateways. Identity was injected into an isolated local handler:
this is NOT a real owner browser/JWT login. No customer data published.
Frontend requires inventorySource=openremote; unavailable/unprovisioned states
hide stale inventory while preserving the session. No menu/layout changes.
Tests: 48 API, 22 frontend unit/render, 4 browser fixture flows PASS. Includes
deep link/refresh/expiry, ownership, no-battery BG/EN, inventory outage/recovery.
Lint has zero errors (two pre-existing image warnings); Pages/RSC builds pass.
Local master auth gate passes; forced-local trusted TLS public issuer/master
denial pass. Normal-DNS external ingress probes from Mac time out; external
owner browser login/expiry and physical temperature remain NOT verified.
Frontend publication result will be recorded after Pages deployment; backend
runtime already serves the compatible OR inventory contract to existing clients.
Next: owner browser acceptance, then generic provisioning/import/update guards;
do not treat this read integration as completion of all legacy write-path debt.

API е ВНЕДРЕН: 381dee9a89bb; частен rollback api-inventory-8YeBtP.
GET /sites пресича текущото GrideX членство с OR Site assets, свързани към
потребителя; имената идват от OR. GET /hardware проверява Site/gateway bindings,
realm, родителите и потребителските връзки при всяка заявка; имена/модели/роли
идват от OR. Локалните портове/конфигурация са само изпълними настройки.
OR отказ -> 503; непълен binding/собственост -> 409; без local-only fallback.
Heartbeat транспортът и редакцията на конфигурации са непроменени.
Пробата с реалните членство/OR данни връща пилотния Обект и два проверени шлюза.
Идентичността е подадена в изолиран локален handler — НЕ е реален owner browser/
JWT вход. Няма публикувани клиентски данни.
Frontend изисква inventorySource=openremote; при отказ/непровизиран ресурс
скрива стария инвентар, без да прекратява сесията. Без промени в меню/оформление.
Минават: 48 API, 22 frontend unit/render и 4 browser fixture сценария, включително
deep link/refresh/expiry, права, BG/EN без батерия и OR отказ/възстановяване.
Lint е без грешки (две стари image предупреждения); Pages/RSC build минава.
Local master auth проверките минават; forced-local trusted TLS public issuer и
забраната за master минават. Normal-DNS ingress от Mac е timeout; външен owner
browser вход/expiry и физическа температура НЕ са потвърдени.
Frontend публикацията ще се запише след Pages deployment; backend вече обслужва
съвместимия OR inventory договор и за текущите клиенти.
Следва owner browser приемане, после общи provisioning/import/update защити.
Това read интегриране не приключва дълга по старите write пътища.


## Pilot inventory reconciled / Пилотен инвентар съгласуван — 2026-09-20

DEPLOYED via supported OpenRemote APIs: pilot Site -> ROCK -> ESP, with the
existing temperature asset reparented under ROCK (same ID/history writer).
All four assets have verified owner links. Owner lacked OR read:assets: granted
that role with restricted_user, NOT unrestricted asset/admin writes. Existing
GrideX administrator membership unchanged. New tokens may be needed to see roles.
Site binding and two gateway bindings are projections of verified OR resources
(migration 009), not independently provisioned inventory. No physical activation,
Ethernet, certificates, MQTT configuration or BESS control changes.
Private backups: inventory-or-XXk1AE before asset creation; inventory-or-ypRcM2
before owner role assignment. Both database dumps passed pg_restore --list;
OR/owner snapshots are private. Final read-back: inventory-or-dHQvbb.
A partial SQL audit failure was corrected; retry reused the same OR IDs.
Eight verification tests + 37 API regression tests PASS; live snapshot validates
hierarchy, owner links, bindings and history writer restricted to its one asset.
Sandbox HTTP tests initially failed EPERM; approved local-port rerun passed.
NOT claimed: owner browser acceptance, physical temperature receipt, or generic
UI/import provisioning enforcement. Those remain pending under the canonical
backend plan. Do not resume local-only bootstrap scripts. Documentation rules
published in backend PR #32, frontend PR #40 and edge PR #20; not merged here.

ВНЕДРЕНО през OpenRemote API: пилотен Обект -> ROCK -> ESP; съществуващият
температурен asset е преместен под ROCK със същия ID/history writer.
Проверени са връзките на четирите assets към собственика. Липсващото OR
read:assets право е добавено с restricted_user, БЕЗ неограничени asset/admin
записи. GrideX администраторското членство е запазено. За новите роли може да
е нужен нов token. Site binding и двата gateway bindings (миграция 009) са
проекции на потвърдени OR ресурси, не отделно провизиран инвентар.
Без физическо активиране, Ethernet, сертификати, MQTT настройки или BESS промени.
Частни backups: inventory-or-XXk1AE преди assets и inventory-or-ypRcM2 преди
owner ролите; двата database dump-а са проверени с pg_restore --list.
OR/owner snapshots са частни; последна проверка inventory-or-dHQvbb.
Поправен е частичен SQL audit отказ; повторението използва същите OR IDs.
8 verification + 37 API regression теста МИНАВАТ; реалният snapshot потвърждава
йерархия, owner links, bindings и writer само до неговия температурен asset.
Първият HTTP тест е блокиран от sandbox EPERM; разрешеното повторение минава.
НЕ са потвърдени: owner browser приемане, физическа температура и универсална
UI/import защита. Те остават задачи по backend плана. Без local-only bootstrap.
Правилата са публикувани в backend PR #32, frontend PR #40 и edge PR #20;
тук не са merge-вани.


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


2026-09-20: OpenRemote resource authority review documented in AGENTS/HANDOFF
and docs/OPENREMOTE_PROVISIONING_AUTHORITY.md. Local-only Site/gateway records
and incomplete OR hierarchy are migration debt. Runtime NOT changed; unified
provisioning, reconciliation and seven acceptance tasks remain pending.
2026-09-20: Правилото OpenRemote да е основен ресурсен регистър е записано в
AGENTS/HANDOFF и новия документ. Local-only Обект/шлюзове и непълната OR йерархия
са миграционен дълг. Runtime НЕ е променен; реализацията и приемането предстоят.

2026-09-20 17:43 UTC: issuer fix DEPLOYED (Manager 26d8f5d46e25); service query,
local auth and temporary PKCE pass. Owner-scoped temperature asset/restricted
writer and history worker 757c2c99dabc DEPLOYED, migration 008 backed up/applied.
37 API tests and isolated Timescale write/permission probe pass; probe removed.
Physical temperature NOT received: ROCK publisher update requires local access,
SSH refused. No frontend/physical success claim. Newest HANDOFF is authoritative.
2026-09-20 17:43 UTC: issuer fix ВНЕДРЕН; service query/local auth/PKCE минават.
Owner температурен asset/restricted writer/worker са ВНЕДРЕНИ; 008 с backup.
37 API теста и isolated Timescale/permissions probe минават; пробата е премахната.
Физическа температура НЯМА: нужен ROCK update, SSH отказан. Виж новия HANDOFF.

2026-09-20: Timescale history preparation, NOT deployed. Existing OR TimescaleDB
2.26.4 confirmed, zero measurement rows. Manager rejects public-issuer service
token; no auth bypass or runtime changes. See newest HANDOFF and
docs/TIMESCALE_DEVICE_HISTORY.md for concrete completion gates.
2026-09-20: подготовка за Timescale история, НЕ е внедрена. Налична OR TimescaleDB
2.26.4, нула измервания. Manager отказва служебния public-issuer token; няма
заобикаляне на auth или runtime промени. Виж най-новия HANDOFF и документа.

2026-09-20 07:19 UTC: owner-approved 365-day Remember Me APPLIED; API restart
gate DEPLOYED, image dd06bf203540 healthy. 31 tests and actual temporary PKCE
pass. Local auth/TLS isolation pass; normal-DNS public probes timeout. Owner
browser acceptance still pending; MQTT continues unchanged. See newest HANDOFF.
2026-09-20 07:19 UTC: одобреният 365-day Remember Me е ПРИЛОЖЕН; API restart
gate е ВНЕДРЕН, dd06bf203540 healthy. 31 теста и реален временен PKCE минават.
Local auth/TLS изолацията минава; normal-DNS public пробите са timeout. Остава
owner browser приемане; MQTT продължава непроменен. Виж последния HANDOFF.

PR #30 merged (801ec1d), runtime still unchanged. Safety review blocked 365-day
Remember Me helper before execution; explicit duration approval needed.
PR #30 е слят (801ec1d), runtime е непроменен. Safety review спря 365-day
Remember Me helper преди изпълнение; нужно е изрично одобрение на срока.

2026-09-20: session restart policy prepared; 31 tests pass, not deployed.
Remember Me real config is disabled; bounded persistent-session helper prepared.
2026-09-20: restart политиката е готова; 31 теста минават, не е внедрена.
Remember Me реално е изключено; готов е helper за дълготрайна ограничена сесия.

2026-09-20 06:11 UTC: PHYSICAL MQTT RECEIPT VERIFIED. ROCK/ESP observations
advance in PostgreSQL; ESP heartbeat 14216→14289. Deployed API reports both
online, worker zero restarts. Browser and offline/reboot acceptance still pending.
2026-09-20 06:11 UTC: РЕАЛЕН MQTT RECEIPT ПОТВЪРДЕН. ROCK/ESP пробите се обновяват
в PostgreSQL; ESP heartbeat 14216→14289. API: двете online, worker 0 рестарта.
Browser и offline/reboot приемането още предстоят.

2026-09-20: real pilot certificate/topic bindings enrolled; heartbeat worker
running/subscribed with zero restarts, no samples yet. Local ROCK activation
helper prepared; execution/physical receipt pending. See newest HANDOFF.
2026-09-20: реалните pilot cert/topic bindings са заведени; worker работи/subscribe,
0 рестарта, още няма проби. Local ROCK activation helper е готов за изпълнение;
физическото активиране/получаване предстои. Виж последния HANDOFF.

Latest deployment: heartbeat API image 14acc9c4a3ca healthy, real SQL reads pass,
zero samples; dirty activation code preserved and not deployed. MQTT LAN test
passes. Physical ROCK bootstrap and worker identity bindings remain blocked.
Последно внедряване: heartbeat API 14acc9c4a3ca healthy, SQL четене работи, 0
проби; dirty activation е запазен/невнедрен. LAN MQTT тестът минава. Остават
блокирани физически ROCK bootstrap и реалните identity bindings за worker.

Latest: migration 007 applied with private validated pg_dump archive; zero live
heartbeat records. MQTT/UI/sensor-profile specification added. ROCK authenticated
access missing; worker/API and physical activation pending. Runtime API uses a
different dirty worktree: preserve activation changes. See newest HANDOFF.

Последно: миграция 007 приложена с частен проверен pg_dump архив; 0 live heartbeat
записа. Добавена MQTT/UI/sensor-profile спецификация. Няма удостоверен ROCK достъп;
worker/API/physical activation предстоят. Runtime API е от друг dirty worktree;
запази activation промените. Виж последния HANDOFF.

2026-09-19: MQTT LAN-only TCP 8883 relay deployed; 6 relay tests and synthetic
mTLS/ACL tests pass. No Ethernet/router changes. Physical ROCK connection and
real identity binding still unproven; see docs/MQTT_LAN_PROXY.md and HANDOFF.
Public auth normal-DNS probe times out; forced-local TLS and denied routes pass.

2026-09-19: LAN-only TCP 8883 relay е внедрен; 6 теста и синтетичен mTLS/ACL тест
минават. Без Ethernet/router промени. Реална ROCK връзка/identity binding не са
доказани; виж docs/MQTT_LAN_PROXY.md и HANDOFF. Public auth normal-DNS е timeout;
forced-local TLS и отказът на защитени маршрути минават.

2026-09-19: per-Site private WireGuard and direct MQTT-mTLS explicitly approved.
Execution plan recorded in backend docs/PER_SITE_TRANSPORT_AND_ENROLLMENT.md;
12 TODO items, documentation-only publication, no live activation. See HANDOFF.

2026-09-19: изрично одобрени WireGuard-private и direct MQTT-mTLS по Обект.
Планът е в backend docs/PER_SITE_TRANSPORT_AND_ENROLLMENT.md; 12 TODO задачи,
само документална публикация, без live активиране. Виж HANDOFF.

Heartbeat feature prepared on feat/device-heartbeat: 30 Node tests pass.
Not deployed; follow docs/DEVICE_HEARTBEATS.md and latest HANDOFF. Real ROCK
MQTT receipt, PostgreSQL migration/integration and browser acceptance pending.

Heartbeat е подготвен във feat/device-heartbeat; 30 Node теста минават.
Не е внедрен; виж docs/DEVICE_HEARTBEATS.md и последния HANDOFF. Остават
реален ROCK MQTT receipt, PostgreSQL миграция/интеграция и browser приемане.

Device setup: selection → max two roles/peers → provisioning moved to Devices.
Admin-only versioned backend draft; no hardware activation. See latest HANDOFF.

Настройки: избор → до две роли/партньори → provisioning в Устройства.
Admin-only versioned backend чернова; без hardware активиране. Виж HANDOFF.

## Day-ahead strategy backlog / Задача за стратегия „ден напред“ — 2026-09-19

Recorded the owner requirement in both HANDOFF files: extend `price_arbitrage`
with frontend selection and backend net-profit optimization including cycle
wear, losses and fees. Planning only; no runtime or battery changes.
Next: agree cost units/versioned contract, implement and test in simulation.

Изискването е записано в двата HANDOFF файла: разширяване на `price_arbitrage`
с frontend избор и backend оптимизация на нетната печалба с износване,
загуби и такси. Само план, без runtime/батерийни промени.
Следва: единици за разходите/versioned договор, реализация и симулационни тестове.

## Device access protection / Защита на device достъпа

Implemented encrypted external vault, administrator-only API and write-only UI.
Backend deployed; frontend lint/build and 22 API tests pass. No real credential,
SSH or OTA operation performed. Browser publication/acceptance, master-key
backup/rotation, telemetry worker and OTA approval execution remain pending.
Full frontend tsc has existing unrelated errors; see HANDOFF.

Реализирани криптиран външен vault, admin-only API и write-only UI. Backend е
внедрен; frontend lint/build и 22 API теста минават. Няма реален credential,
SSH/OTA операция. Остават browser публикация/приемане, master-key backup/rotation,
telemetry worker и изпълнение на OTA одобрения. Пълният tsc има стари несвързани
грешки; виж HANDOFF.

## Test pair registration / Регистрация на тестовата двойка — 2026-09-19

Owner-authorized local test inventory now contains a commissioning Site and
two draft gateways (ROCK Pi E, ESP32 lab), assigned via organization admin.
Idempotent repeat verified. Sanitized demo example prepared; frontend lint/build
pass (two existing image warnings). No actual telemetry or device writes enabled.
See HANDOFF for remaining live integration and publication.

Одобреният локален тестов inventory съдържа commissioning Обект и два draft
gateway записа (ROCK Pi E, ESP32 lab) към администратора на организацията.
Повторният старт е проверен без дублиране. Обезличеният демо пример е подготвен;
frontend lint/build минават с две стари image предупреждения. Няма включени
реална телеметрия или device writes. Остатъчните стъпки са в HANDOFF.

## Proxy upstream correction / Корекция на proxy upstream — 2026-09-19

Live nginx had stale Docker IPs after recreation: auth reached API. Applied
dynamic Docker DNS and reloaded successfully; discovery/API/denied-route probes
pass. CORS unchanged. Password setup reported complete; fresh user login pending.

Live nginx пазеше стари Docker IP след recreation: auth стигаше API. Приложени
динамичен Docker DNS и успешен reload; discovery/API/blocked-route пробите минават.
CORS не е променян. Зададена парола според потребителя; новият вход предстои.

## Live email enrollment / Реална email регистрация — 2026-09-19

Deployed Keycloak 26.7.3 Mailgun REST provider with configurable BCC. One private
backend `.env` now replaces split inputs (private rollback retained). Initial
organization/admin membership and dedicated enrollment client provisioned; real
Keycloak registration email accepted, audit queued. Keycloak/API healthy,
device writes still off. API tests: 19 passed. User must personally confirm
delivery and finish email verification/password and browser login; these are
not yet proven. See newest HANDOFF entry and docs/MAILGUN_API.md; older blocker
entries below are historical, not the current deployment status.

Внедрен Keycloak 26.7.3 Mailgun REST provider с конфигурируем BCC. Единният частен
backend `.env` замени разделените входове, със запазен rollback. Създадени начална
организация/admin членство и отделен enrollment клиент; истинска регистрационна
покана е приета, audit е queued. Keycloak/API healthy, device writes изключени.
19 API теста преминават. Личното потвърждение на доставка, email/password и browser
вход предстои. Виж новия HANDOFF и docs/MAILGUN_API.md; старите blockers са история.

## Delivery test queued / Тестово писмо в опашката — 2026-09-19

Real owner-requested test email accepted by Mailgun as queued. Not a registration
or proof of inbox delivery. Enrollment disabled; no active enrollment client;
zero organizations. Need initial organization/role and Keycloak Mailgun HTTP
integration before first registration; no account created.

Реално поискано от собственика тестово писмо е прието в Mailgun опашката. Това
не е регистрация или доказана доставка в пощата. Enrollment е изключен, няма
активен enrollment клиент и организации. Нужни са начална организация/роля и
Keycloak Mailgun HTTP интеграция преди първата регистрация; няма създаден профил.

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
