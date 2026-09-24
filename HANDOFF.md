# Handoff — GrideX OpenRemote backend

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## Persistent all-event email opt-in — 2026-09-24 / Постоянно включване на мейл

EN: Owner clarified: one persistent user checkbox for ALL future event types,
NOT incident-by-incident approval or a heartbeat-only preference. Email is OFF
by default. Only missed-heartbeat events have a connected producer today;
future event producers must use the same opt-in and authorization gate before
claiming that they send email. `GET/PUT /api/v1/me/email-notifications` is the
general API (the previous heartbeat-specific path remains as an alias). The
legacy `heartbeat_email_subscriptions` table currently stores this general
preference; future producers must use it, not create independent consent.
Verified Keycloak email is captured from
the authenticated claim on opt-in; the worker rechecks current database Site
membership and OpenRemote user–Site asset linkage before each send. It claims
one delivery per user/device/outage before Mailgun and sends no retrospective
mail if opt-in occurs during an open outage. The existing Devices menu warning
remains separate. Migrations 010 and 011 were applied to the local database
after private validated backups; no subscription exists yet. The API and alert
worker were deployed and are healthy; 0 enabled subscriptions and 0 deliveries
were confirmed. The general endpoint revision was deployed with settings
preserved and API healthy; unauthenticated local request returned 401. Private
rollback: `api-inventory-nbpoQm`. PR #33 is stacked on #32. No real mail has
been sent. Frontend PR #45 merged to main and Pages deployment succeeded.
Next: verify real owner-browser checkbox and one non-destructive
outage/recovery test. Public auth regression normal-DNS probes failed from this
Mac; local master checks passed, so do not claim external auth accepted from
this run. See `docs/DEVICE_HEARTBEATS.md`.

BG: Собственикът уточни: един постоянен checkbox за ВСИЧКИ бъдещи видове
събития, НЕ одобрение за всеки инцидент и не само за heartbeat. Мейлите са
ИЗКЛЮЧЕНИ по подразбиране. Засега само прекъсване на heartbeat има свързан
източник; бъдещите обработчици трябва да ползват същото съгласие и проверка на
правата. Общият API е `GET/PUT /api/v1/me/email-notifications`; старият път
остава alias. Съществуващата таблица с историческо име пази общата настройка.
Потвърденият Keycloak
адрес се взема от удостоверения token при включване; worker проверява текущите
права в базата и OpenRemote връзката потребител–Обект преди всяко писмо.
Записва се един опит на потребител/устройство/прекъсване преди Mailgun. При
включване по време на текущ инцидент няма стар мейл. Отделният знак в меню
„Устройства“ остава. Миграции 010 и 011 са приложени локално след проверени
частни архиви; още няма абонамент. API и worker са пуснати и работят; проверени
са 0 включени абонамента и 0 изпращания. Общият endpoint е внедрен със запазени
настройки и здрав API; локална заявка без вход върна 401. Частен rollback:
`api-inventory-nbpoQm`. PR #33 е върху #32. Не е изпратен реален мейл.
Frontend PR #45 е слят в main и Pages внедряването мина. Следва реален
браузърен/неразрушителен тест.
Публичните auth проби с нормален DNS от този Mac не минаха; локалният master
мина, затова външният вход не е потвърден от тази проверка.

## Six physical ROCK metrics verified / Шест реални ROCK показателя — 2026-09-24

This supersedes the five-metric/CPU-pending status below. After the operator's
CPU sensor opt-in, OpenRemote TimescaleDB contains fresh `cpuTemperatureC`
datapoints. A separate read through the OpenRemote datapoint API returned 21
CPU readings in the last hour, latest 52.083 °C at that check. The other five
system metrics continue to arrive. The full ROCK → MQTT → backend outbox →
OpenRemote history path is therefore confirmed for all six metrics. Public
Devices UI is published through frontend PR #42; authenticated owner-browser
rendering, cross-owner denial and longer stability remain separate acceptance
checks. No new writer roles, Ethernet/VPN/control or battery MODBUS changes.

Това заменя по-стария статус за пет показателя/чакаща CPU температура. След
включването на CPU сензора от оператора OpenRemote TimescaleDB съдържа пресни
`cpuTemperatureC` datapoints. Отделна заявка през OpenRemote datapoint API
върна 21 CPU измервания за последния час, последно 52.083 °C при проверката.
Другите пет показателя продължават да пристигат. Пътят ROCK → MQTT → backend
outbox → OpenRemote history е потвърден за всички шест. Публичният екран
„Устройства“ е публикуван през frontend PR #42; реалното показване при owner
вход, отказът за чужд собственик и дългата стабилност са отделни проверки.
Без нови роли, Ethernet/VPN/control или MODBUS промени към батерията.

## ROCK system telemetry live path / Реален път на телеметрията — 2026-09-24

Physical ROCK activation reported `ROCK_SYSTEM_TELEMETRY_ACTIVE` with one
MQTT connection and one local publish during its bounded acceptance check.
The existing broker was reloaded in place to apply its topic ACL; no Ethernet,
VPN, MODBUS/control or proxy setting was changed. The six system metric Assets
were provisioned in OpenRemote, but five newly created Assets lacked the
restricted history-writer service-user link. This produced HTTP 403 and a
retrying outbox even though MQTT ingestion worked. An idempotent OpenRemote API
reconciliation added exactly five missing links, preserving the writer's
`restricted_user` and attribute-only write scope; a validated private OpenRemote
DB backup is in `private-backups/rock-history-writer-OSimep`. All observed
queued rows drained. Read-only Timescale checks showed growing datapoint counts
for uptime, load1, available RAM, data free space and journal size (15 to 24
per metric during checks). This proves ROCK → MQTT → backend → OpenRemote
Timescale for those five metrics, not external browser rendering. CPU
temperature remains absent; check the ROCK sensor/config before claiming it.
The normal provisioning script now grants/verifies the restricted writer link
and preserves other Sites' bindings. The standalone reconciliation script is
for backed-up recovery only. Still required: longer stability window, CPU
sensor diagnosis, authenticated owner Devices UI acceptance, and cross-owner
denial. Do not report all six metrics or UI as completed.

Физическото включване на ROCK върна `ROCK_SYSTEM_TELEMETRY_ACTIVE` с MQTT връзка
и локално публикуване. Broker ACL бе презареден без рестарт; без Ethernet,
VPN, MODBUS/control или proxy промени. Шестте системни Assets са в OpenRemote,
но пет нови нямаха връзка към ограничения history writer. Това причиняваше
HTTP 403 и повторения в outbox въпреки успешния MQTT прием. През OpenRemote API
са добавени точно петте липсващи връзки, без нови права; проверен частен backup:
`private-backups/rock-history-writer-OSimep`. Чакащите редове се доставиха;
реалните Timescale datapoints за uptime, load1, свободна RAM, свободно място
и journal size нараснаха от 15 до 24 за всеки показател. Това доказва пътя
ROCK → MQTT → backend → Timescale за тези пет, но не доказва външния UI.
CPU температура още липсва и изисква проверка на сензор/настройка в ROCK.
Обичайният provisioning вече проверява връзката към writer и не премахва
binding-и на други Обекти. Остават по-дълъг stability тест, CPU диагностика,
потребителска проверка на „Устройства“ и отказ за чужд собственик.

## ROCK system telemetry prepared / Подготвена системна телеметрия — 2026-09-23

The implementation is staged across backend, edge and frontend branches. The
backend accepts only configured per-Site MQTT `/system/telemetry` bindings with
metric/unit/range/timestamp/gateway validation, deduplicates through the existing
outbox and reads history from OpenRemote's datapoint API after owner permission
checks. The edge image has read-only Linux collectors for CPU temperature,
uptime, load1, memory available, data free space and journal size; publishing is
off by default in the example env. Devices now displays the latest values without
Grafana. No live ROCK deployment or control/MODBUS/Ethernet change was made in
this preparation; physical activation requires approved OpenRemote bindings and
the existing commissioning acknowledgement.

Реализацията е подготвена в backend, edge и frontend. Backend приема само
конфигурирани за Обекта MQTT `/system/telemetry` binding-и и валидира метрика,
единица, граници, време и gateway; съществуващият outbox записва към OpenRemote,
а history API проверява правата. Edge image има read-only Linux четене на CPU
температура, uptime, load1, RAM, свободно място и journal; примерният env е
изключен до одобрено провизиране. Устройства показва последните стойности без
Grafana. Няма live deployment или промяна на control/MODBUS/Ethernet.

## External Manager activated; acceptance incomplete / Активиран Manager; непълно приемане — 2026-09-22

EN — Scoped proxy and existing `openremote` browser-client callbacks are now
APPLIED on the existing auth origin, `/manager/?realm=gridex`. No new DNS,
certificate, container restart, role grants, Ethernet or VPN changes. Nginx
configuration validation/reload passed; private rollback is under
`private-backups/public-manager-V36M4o` (proxy and original client representation).
Scripts: `deploy-public-manager.mjs` (inspect/apply), `public-manager-proxy.mjs`,
`public-manager-client-inner.mjs`, `check-public-manager.mjs`.
Generation is explicit; the canonical `deploy/public-https/nginx.conf.template`
now includes the same scoped Manager routes, so future rendering preserves the
runtime surface. The single backend env is the source
of the existing public auth origin; no additional operator settings file.

Initial REST surface is for viewing: asset queries/read, models, map reads,
accessible realms and current-user info. Mutating REST operations are not enabled;
this is not completion of remote provisioning/edit workflows. WebSocket retains
OpenRemote authentication/permissions and enforces the exact public Origin.
Two exact `/api/master/` bootstrap paths (`info`, `configuration/manager`) return
synthetic public JSON from nginx, NEVER proxy to master; all other master paths
remain denied. Synthetic version is pinned to 1.30.0: review on Manager upgrades.

Evidence: 3 generator tests passed; nginx -t passed; forced-local trusted-TLS
Manager HTML and bootstrap 200; fresh `openremote` callback accepted/password
form 200; master/admin/health/metrics and realm/user-management paths 404;
anonymous current-user and missing-Origin WebSocket denied. Mandatory auth gate
passed all 3 local master checks. Its public normal-DNS checks FAILED from this
Mac due to connection timeouts; Chrome public navigation also timed out.
This does NOT establish either an external outage or external success.
Owner subsequently confirmed that the external Manager works. Remaining acceptance
is the separate authenticated asset/telemetry/event-bus, refresh, logout,
expiry/re-login and cross-owner-denial evidence; inspect actual browser network
requests before extending the allowlist. Do not treat the route smoke test as
proof of those separate workflows.
Run `node scripts/check-public-manager.mjs PRIVATE_ENV --local` for repeatable
local ingress checks; omit --local for normal DNS (not necessarily external).

BG — Ограниченият proxy и callbacks на съществуващия browser клиент `openremote`
са ПРИЛОЖЕНИ към текущия auth адрес, `/manager/?realm=gridex`. Без нов DNS,
сертификат, рестарт на контейнери, нови роли, Ethernet или VPN промени. Nginx
валидацията/reload минаха; частният rollback е в
`private-backups/public-manager-V36M4o` (proxy и оригиналният клиент).
Скриптове: `deploy-public-manager.mjs` (inspect/apply), `public-manager-proxy.mjs`,
`public-manager-client-inner.mjs`, `check-public-manager.mjs`.
Генерирането е изрично; каноничният `deploy/public-https/nginx.conf.template`
вече съдържа същите ограничения за Manager и бъдещото генериране ги запазва.
Текущият auth адрес се чете от единния backend env;
няма допълнителен операторски файл с настройки.

Първоначалните REST маршрути са за преглед: asset заявки/четене, модели, карти,
достъпни realms и информация за текущия потребител. Променящите REST операции
не са включени; това не завършва remote provisioning/edit процесите. WebSocket
запазва OpenRemote автентикацията/правата и изисква точния публичен Origin.
Два точни `/api/master/` bootstrap пътя (`info`, `configuration/manager`) връщат
синтетичен публичен JSON от nginx, НИКОГА proxy към master; останалите master
пътища са забранени. Синтетичната версия е 1.30.0: преглед при Manager upgrade.

Доказателства: 3 generator теста и nginx -t минаха; forced-local trusted-TLS
Manager HTML/bootstrap 200; callback `openremote` е приет с password форма 200;
master/admin/health/metrics и realm/user-management пътища 404; анонимен current-
user и WebSocket без Origin са отказани. Задължителната auth проверка мина
трите local master теста. Публичните normal-DNS проверки от Mac се ПРОВАЛИХА
с connection timeout; Chrome публичната навигация също изтече. Това НЕ доказва
нито външен отказ, нито външен успех.
Собственикът потвърди, че външният Manager работи. Остават отделните доказателства
за автентикирани assets/телеметрия/event-bus, refresh, изход, expiry/нов вход и
отказ за чужд собственик; преди разширяване на allowlist провери реалните
browser мрежови заявки. Smoke тестът на маршрута не доказва тези процеси.
Повторима локална проверка: `node scripts/check-public-manager.mjs PRIVATE_ENV --local`;
без --local се използва normal DNS (не непременно външен достъп).

## Approved external Manager approach / Одобрен външен Manager достъп — 2026-09-22

EN — DECISION RECORDED; NOT DEPLOYED. Use the existing public authentication
origin with `/manager/?realm=gridex`, sharing its trusted certificate and HTTPS
port 443. This replaces the proposed separate `or` subdomain; do not request a
new DNS record or certificate solely for Manager. Resolve the actual hostname
from the single private backend env; no additional operator configuration file.
Keep `/auth/` on Keycloak. Route Manager static resources and only its required,
reviewed realm-scoped API/WebSocket paths to OpenRemote through the proxy.
This is a scoped exception to the older browser-to-GrideX-API-only rule, not
permission for a catch-all OpenRemote proxy. Preserve authenticated user/asset
permissions, the public gridex issuer and local master administration. Master,
Keycloak admin, health, metrics, databases and other management services remain
non-public. No Ethernet, router, VPN or menu changes are required by this decision.

Pending implementation and acceptance:

1. Inspect Manager 1.30.0 resource/API/event-bus paths and client settings;
   establish a minimal allowlist with all other paths denied.
2. Back up current proxy/OIDC settings; render from the single backend env,
   preserve dynamic Docker DNS and add WebSocket forwarding. Validate before
   reload and retain a tested rollback path.
3. Configure only the required Manager client redirect URIs/web origins; preserve
   existing portal callbacks, local access and strict issuer/TLS validation.
4. Run `scripts/check-auth-routing.mjs` and route-denial tests. Test real external
   browser login, refresh, logout, expiry/re-login, event-bus reconnect and
   authorized asset visibility/cross-owner denial. A local probe or HTTP 200
   is not external acceptance. Record results and deployment revision here.

Current blocker: proxy/client changes and the above tests have not been performed.
Next action: inspect the pinned Manager routes and prepare the scoped proxy change.
This entry changes documentation only; the proposed URL is not yet a live service.

BG — РЕШЕНИЕТО Е ЗАПИСАНО; НЕ Е ВНЕДРЕНО. Използваме съществуващия публичен
auth адрес с `/manager/?realm=gridex`, неговия доверен сертификат и HTTPS порт
443. Това заменя предложението за отделен `or` поддомейн; не се изисква нов DNS
запис или сертификат само за Manager. Реалният hostname се чете от единния
частен backend env, без допълнителен операторски конфигурационен файл.
`/auth/` остава към Keycloak. Статичните Manager ресурси и само необходимите,
проверени realm-scoped API/WebSocket маршрути минават през proxy към OpenRemote.
Това е ограничено изключение от старото правило browser само към GrideX API,
не разрешение за общ proxy към всички OpenRemote маршрути. Запазват се правата
на потребителя по assets, публичният gridex issuer и локалната master
администрация. Master, Keycloak admin, health, metrics, базите и останалите
административни услуги остават непублични. Решението не изисква Ethernet,
рутер, VPN или меню промени.

Предстояща реализация и приемане:

1. Проверка на ресурсите/API/event-bus маршрутите и клиентските настройки на
   Manager 1.30.0; минимален списък с разрешени пътища, всички останали забранени.
2. Backup на proxy/OIDC настройките; генериране от единния backend env,
   запазен динамичен Docker DNS и WebSocket forwarding. Проверка преди reload
   и изпитан начин за връщане назад.
3. Само необходимите redirect URI/web origins за Manager клиента; запазени
   portal callbacks, локален достъп и строги issuer/TLS проверки.
4. `scripts/check-auth-routing.mjs` и тестове на забранените маршрути. Реален
   външен browser вход, refresh, изход, изтичане/повторен вход, event-bus
   reconnect и видимост на разрешените assets/отказ за чужд собственик.
   Локална проба или HTTP 200 не доказват външно приемане. Резултатите и
   внедрената ревизия се записват тук.

Текущ блокер: proxy/client промените и тестовете още не са изпълнени.
Следва: проверка на маршрутите на pinned Manager и подготовка на ограничения proxy.
Този запис променя само документация; предложеният URL още не е активна услуга.

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


## Provisioning authority review / Преглед на provisioning — 2026-09-20

Owner requires OpenRemote as the sole operational resource registry. Mandatory
AGENTS rule and docs/OPENREMOTE_PROVISIONING_AUTHORITY.md added. Review confirms
local-only Site/gateway provisioning, optional OR parent and partial-failure
consistency gaps. The owner-linked temperature asset is NOT a complete Site/
ROCK/ESP hierarchy. Implementation, reconciliation and acceptance tests remain
PENDING: follow the seven-step backlog in that document. Documentation-only;
no runtime migration, asset deletion, permission or network changes in this turn.

Собственикът изисква OpenRemote да е единственият основен ресурсен регистър.
Добавени са задължително AGENTS правило и docs/OPENREMOTE_PROVISIONING_AUTHORITY.md.
Потвърдени са local-only Обект/шлюзове, незадължителен OR родител и пропуски при
частични откази. Температурният asset НЕ е пълна Обект/ROCK/ESP йерархия.
Реализация, съгласуване и тестове са НЕЗАВЪРШЕНИ — следвай седемте задачи в
документа. Само документация; без миграции, изтриване, промени в права или мрежа.

## Live temperature pilot / Жив температурен пилот — 2026-09-20 17:43 UTC

Supersedes the issuer blocker below. DEPLOYED Manager image 26d8f5d46e25
(`gridex-openremote-manager:1.30.0-realm-issuer-v1`): pinned upstream class with
one exact per-realm issuer override; signature/expiry/audience checks preserved.
Build regression accepts public gridex + local master, rejects wrong issuer,
realm, signature, expiry and audience. GrideX service asset query now succeeds.
Local master issuer/admin form pass; temporary PKCE login passes. Forced-local
trusted TLS public issuer passes and public master stays 404. Normal-DNS public
probes from Mac still time out; owner external/browser expiry flow NOT retested.
Runtime rollback: private-backups/manager-issuer-1789925246780 (env + manifest).

Owner email resolved privately and verified against administrator membership and
pilot controller/Site binding. Created a ThingAsset with cpuTemperatureC history
enabled, linked to the owner and a dedicated restricted writer. Writer has only
read:assets/write:attributes and sees only its assigned asset. No write:assets,
rules or battery commands. Secrets/bindings are in the ONE backend env.
Private provisioning record: temperature-provisioning-1789925554199.

Migration 008 creates a durable transport outbox (NOT the history store); private
pg_dump archive/index verified: history-outbox-1789925715802. History worker
757c2c99dabc is deployed/subscribed, zero restarts. Existing API/heartbeat worker,
broker, Ethernet and BESS locks untouched. It accepts only fresh, non-retained,
bound ROCK health cpuTemperatureC numbers (-40..150 C), skips null/missing data,
deduplicates by asset/metric/time and retries queued timestamped OR writes.
MQTT acknowledgement before DB intake is not yet durable end-to-end; overload
or intake failure can lose an observation. Pending queue has no capacity policy
yet. Billing/export/retention and generic per-sensor mappings remain unfinished.

Acceptance: 37/37 API tests; isolated synthetic attribute -> actual Timescale row
PASS; restricted writer denied unrelated probe asset. Probe asset/client/row
removed; no synthetic data placed in owner temperature history. OpenRemote's
database timestamp is timezone-naive and uses JVM timezone (currently upstream
Europe/Amsterdam); do not assume UTC in raw SQL. Use the supported history API.

BLOCKER for physical completion: current ROCK health packets have NO temperature
field. Optional CPU publisher prepared in edge repo (8/8 native CTests), but NOT
installed on board: noninteractive SSH refused. Need approved local upgrade,
verify thermal zone is CPU, enable GRIDEX_CPU_TEMPERATURE_ENABLED=1 in existing
/etc/gridex/gridex-rockpie.env, retain keys/control locks, then verify real MQTT
sample -> outbox -> Timescale -> owner frontend. No real temperature/UI success
is claimed. Config editing/acknowledgement in UI is also still pending.

Замества issuer блокера по-долу. ВНЕДРЕН Manager 26d8f5d46e25 с ограничен
per-realm issuer override; подпис/срок/audience се проверяват. Build тестовете
приемат public gridex/local master и отказват грешни issuer/realm/signature/
expiry/audience. GrideX service query вече минава. Local master/admin форма и
временен PKCE вход минават; forced-local trusted TLS public issuer е правилен,
public master е 404. Normal-DNS от Mac е timeout; външен owner browser/expiry
вход не е повторно проверен. Rollback: manager-issuer-1789925246780.

Собственикът е проверен по email, администраторско членство и pilot ROCK/Обект.
Създаден ThingAsset с cpuTemperatureC history, свързан със собственика и отделен
restricted writer. Той има само read:assets/write:attributes и вижда единствения
назначен asset; без write:assets/rules/команди към батерия. Тайни/bindings са в
ЕДИННИЯ backend env. Private record: temperature-provisioning-1789925554199.

Миграция 008 добавя устойчив transport outbox, НЕ историческа база; pg_dump/index
backup е проверен: history-outbox-1789925715802. Worker 757c2c99dabc е внедрен,
subscribe-нат, 0 рестарта. API/heartbeat/broker/Ethernet/BESS locks са непокътнати.
Приема само пресни non-retained cpuTemperatureC числа (-40..150 C) от точния ROCK,
пропуска null/липсващи данни, deduplicate-ва по asset/metric/time и повтаря queued
timestamped OR writes. MQTT ACK преди DB intake още не е устойчив end-to-end;
overload/DB intake отказ може да загуби проба. Няма capacity policy за pending
queue. Billing/export/retention и общи sensor mappings остават незавършени.

37/37 API теста; изолиран synthetic attribute -> реален Timescale ред PASS;
writer няма достъп до чужд probe asset. Probe asset/client/ред са премахнати,
без демо температура в owner историята. DB timestamp е без timezone и следва
JVM timezone (upstream Europe/Amsterdam); не приемай UTC в raw SQL, ползвай API.

Физически БЛОКЕР: текущите ROCK пакети НЯМАТ температура. Edge CPU publisher е
готов (8/8 native CTest), но НЕ е качен: noninteractive SSH е отказан. Нужни са
одобрен local upgrade, проверка че thermal zone е CPU и
GRIDEX_CPU_TEMPERATURE_ENABLED=1 в текущия /etc/gridex/gridex-rockpie.env;
запазване на keys/locks, после реална MQTT проба -> outbox -> Timescale -> owner
frontend. Не е обявена реална температура/UI готовност. UI редакция/ack също
още предстоят.

## Timescale history — INCOMPLETE / Timescale история — НЕЗАВЪРШЕНО — 2026-09-20

Owner requires historical measurements for all connected equipment in Timescale,
with per-device periods/metrics, not a fixed 15-minute interval. Live inspection
confirms existing OpenRemote TimescaleDB 2.26.4, two hypertables and seven-day
compression; asset_datapoint has zero rows. Pilot heartbeat reception is a
different path. Service-to-Manager calls fail 401 / Invalid token issuer;
service role is also read-only. Do not bypass issuer validation or break local
master login. No runtime deployment/configuration changes made for this task.
Prepared blueprints use proper metadata maps, selected history attributes and
validated desired telemetry profiles; missing boolean readings now remain null.
Interval aggregation is explicitly rejected, not silently treated as applied.
Read-only audit script and full acceptance/retention plan:
docs/TIMESCALE_DEVICE_HISTORY.md. Remaining: issuer compatibility, scoped writer,
inventory mapping, durable MQTT measurement ingestion, real history/API/UI test,
profile acknowledgement and export/paid retention. This task is NOT complete.
Validation: 34/34 API tests pass (including per-metric metadata isolation,
unsupported interval rejection, Site authorization and session regression).
Read-only live Timescale audit passes; this is not an ingestion acceptance test.

Собственикът изисква история за всички свързани устройства в Timescale с отделни
периоди/показатели, не общи 15 минути. Проверени са налична TimescaleDB 2.26.4,
два hypertables и седемдневна компресия; asset_datapoint има нула реда.
Pilot heartbeat идва по друг път. Service→Manager връща 401 / Invalid token
issuer; служебната роля е само за четене. Без заобикаляне на issuer или счупване
на local master входа. За задачата няма runtime deployment/config промени.
Подготвени са правилни metadata maps, избрани history атрибути и валидирани
желани профили; липсващите boolean измервания са null. Интервална агрегация се
отказва изрично, не се представя като приложена. Read-only audit и пълни
приемателни стъпки/retention: docs/TIMESCALE_DEVICE_HISTORY.md. Остават issuer
съвместимост, scoped writer, mappings, устойчив MQTT ingestion, реален history/
API/UI тест, profile acknowledgement, export/paid retention. НЕ е приключено.
Проверки: 34/34 API теста минават (изолация на metadata по показател, отказ на
неподдържан интервал, Site права и session regression). Read-only Timescale
проверката минава; тя не е приемателен ingestion тест.

## Owner session policy / Политика за сесии — 2026-09-20

UPDATE 07:19 UTC: owner confirmed execution after the explicit 365-day proposal.
Helper applied successfully with private rollback directory session-policy-1789888624581.
Remember Me idle/max = 365 days; ordinary session limits unchanged. API image
dd06bf203540 is healthy with restart gate enabled. Rollback image:
gridex-api:before-session-policy-20260920. Only API restarted. 31 tests pass;
actual temporary PKCE login confirms recent auth_time, probe identity/client deleted.
Local master/admin/form checks pass. Forced-local trusted TLS: public issuer
correct, master/admin/health/metrics 404, unauthenticated API 401. Normal-DNS
public probes from Mac time out: external reachability is NOT accepted by these
checks. Real owner refresh/logout/reopening remains an acceptance task, not a
completed test. MQTT continues: ROCK receipt 07:19:32Z; ESP contact 07:19:38Z,
counter 22487; worker/broker zero restarts. Earlier blocked status below is historical.

АКТУАЛНО 07:19 UTC: собственикът потвърди изпълнение след предложението за 365 дни.
Helper е приложен с частен rollback session-policy-1789888624581. Remember Me
idle/max = 365 дни; обикновените лимити са непроменени. API dd06bf203540 е healthy,
restart gate е включен. Rollback image: gridex-api:before-session-policy-20260920.
Рестартиран е само API. 31 теста минават; реален временен PKCE вход потвърждава
актуален auth_time, тестовите identity/client са изтрити. Local master/admin/form
минават. Forced-local доверен TLS: правилен public issuer, master/admin/health/
metrics 404, API без вход 401. Normal-DNS пробите от Mac са timeout: това НЕ
доказва външна достъпност. Реален owner refresh/logout/reopening остава приемателна
проверка. MQTT продължава: ROCK 07:19:32Z; ESP контакт 07:19:38Z, counter 22487;
worker/broker без рестарти. По-старият blocked статус по-долу е исторически.

PR #30 merged as 801ec1d. Runtime application NOT performed: safety review
rejected configure-session-policy.mjs before execution because 365-day realm
session lifetime requires explicit duration approval. Existing realm/env/API
remain unchanged; do not bypass this rejection. Frontend counterpart is live
(release 1f24bad). Next obtain approved duration, run helper with private backup,
deploy API, verify auth gate and owner login/refresh/restart end-to-end.

PR #30 е слят като 801ec1d. Runtime НЕ е променен: safety review отказа helper
преди изпълнение, защото срокът 365 дни изисква изрично потвърждение. Realm/env/
API остават непроменени; без заобикаляне. Frontend е live (1f24bad). Следва
одобрен срок, helper с private backup, API deployment, auth gate и owner
вход/refresh/restart от край до край.

Real integration gate: test-session-auth-time.mjs creates and deletes a temporary
unprivileged identity/client, copies portal default scopes and completes actual
authorization-code + PKCE login. Access-token auth_time is present and recent.
Direct password grant is NOT representative (it omitted auth_time); browser flow
was verified instead. No owner password/session or Site data used; no email sent.

Реална проверка: test-session-auth-time.mjs създава/изтрива временен потребител
и клиент без права, копира portal scopes и изпълнява authorization-code + PKCE.
Access token има актуален auth_time. Direct password grant не е представителен
(липсва auth_time); проверен е browser потокът. Без owner парола/сесия, данни
от Обекти или изпратен имейл.

Refresh must preserve login; an API restart must require fresh portal login.
Optional GRIDEX_REAUTH_ON_API_RESTART checks portal azp and signed auth_time
against API start, not refreshed iat. Dedicated service clients are unchanged.
This is a single-instance policy; clustered deployments need a shared epoch.
31 tests pass. Real realm inspection: Remember Me disabled; normal idle/max 24h.
configure-session-policy.mjs enables Remember Me with a private rollback, one
operator env and GRIDEX_REMEMBER_SESSION_DAYS (default/cap 365). It does not
make perpetual tokens or modify master/issuer/client callbacks. Not applied yet.
Deploy frontend error handling FIRST, then API gate. Hardware/MQTT unaffected.

Refresh пази входа; API рестарт изисква пресен portal вход. Опционалният
GRIDEX_REAUTH_ON_API_RESTART проверява portal azp/подписания auth_time спрямо
API старта, не обновения iat. Служебните клиенти не се променят. За един instance;
клъстер изисква общ epoch. 31 теста минават. Реален realm: Remember Me изключено,
normal idle/max 24h. configure-session-policy.mjs включва Remember Me с частен
rollback, един env и GRIDEX_REMEMBER_SESSION_DAYS (default/max 365). Без вечни
токени или master/issuer/callback промени. Още не е приложено. Първо frontend
обработка на грешката, после API gate. Без hardware/MQTT промени.

## Physical heartbeat receipt verified / Реален heartbeat потвърден — 2026-09-20

Owner ran corrected activation helper and reported ROCK_MQTT_STARTED, with local
rollback backup. Independent PostgreSQL checks now prove actual ROCK → LAN mTLS
proxy → broker → worker → database delivery. At 06:10 UTC: ROCK observation/receipt
06:10:41; ESP receipt 06:10:43, successful contact 06:10:42, heartbeat 14216.
Second check: ROCK receipt 06:11:11; ESP receipt/contact 06:11:19, heartbeat 14289.
Deployed API heartbeatStatuses returns online/sourceStatus online for both.
Worker running, zero restarts, no recent rejection logs. No synthetic samples
were submitted to the real inventory. These observations supersede no-receipt
blockers below; they do NOT prove browser rendering, reboot/expiry recovery,
long-duration soak, sensor-profile metrics or battery/vendor telemetry.
Next: owner Devices UI acceptance, then controlled offline/reconnect tests.
No Ethernet/VPN/ESP firmware/BESS control change in this verification.

Собственикът изпълни поправения helper и получи ROCK_MQTT_STARTED с local backup.
Независимите PostgreSQL проверки доказват ROCK → LAN mTLS proxy → broker → worker
→ база. Първа проба 06:10 UTC: ROCK observation/receipt 06:10:41; ESP receipt
06:10:43, успешен контакт 06:10:42, heartbeat 14216. Втора проба: ROCK receipt
06:11:11; ESP receipt/contact 06:11:19, heartbeat 14289. Внедреният API изчислява
online/sourceStatus online за двете. Worker работи без рестарти и скорошни откази.
Без synthetic данни в реалния inventory. Това отменя старите no-receipt блокери,
но не доказва browser rendering, reboot/expiry, soak, sensor-profile или battery
измервания. Следват owner Devices UI и контролирани offline/reconnect проверки.
Без Ethernet/VPN/ESP firmware/BESS промени в тази проверка.

## Activation gate parser fix / Поправка на проверката за заключване — 2026-09-20

Owner's activation attempt stopped before backup/service/config mutation.
Old regex excluded digits, missed GRIDEX_APPROVE_INT32_WORD_ORDER and counted
only three of four locked gates. Now checks all four exact required names,
rejects duplicates and nonzero/malformed values. Five regression tests pass
(INT32, quoted/CRLF, missing, unlocked/malformed, duplicate). Private imported
config reports all four gates zero. Physical retry still required; no bypass.

Опитът на собственика спря преди backup/service/config промени. Старият regex
изключваше цифри и пропускаше GRIDEX_APPROVE_INT32_WORD_ORDER. Новата проверка
изисква четирите точни имена, отказва дубликати и nonzero/невалидни стойности.
5 regression теста минават (INT32, quotes/CRLF, missing, unlocked/malformed,
duplicate). Частният импорт има четири нули. Предстои physical retry; без bypass.

## Pilot MQTT reader active / Пилотен MQTT reader активен — 2026-09-20

Owner confirmed physical client certificate installation and matching key.
Enrolled its verified clientAuth CN against the sole existing pilot controller
and node; imported config confirms one polling slot. Exact health/slot-1 ACL,
existing reader gets read-only access. Private inventory/bindings/settings bundle
remain outside Git. Worker started on private MQTT/backend networks, matching
host UID/GID for 0600 reader files: subscription active, restart count zero.
No device records yet. Prepared scripts/activate-rock-mqtt.py for one-time local
execution: validates certificate/key, locked gates, payload hash/MQTT linkage;
backs up/replaces only service binary and MQTT env keys, rolls back on start failure.
Syntax checked, not yet run on physical ROCK. No Ethernet/ESP/OT changes.
Next: owner copies private settings bundle + activation helper to ROCK, runs it
against their verified staged payload, then verify actual DB/UI receipt/ageing.
Do not rerun legacy prepare-mqtt.py: it creates a separate env and broadens node
ACLs; exact-slot regeneration and full automatic claim remain backlog.

Собственикът потвърди инсталиран клиентски сертификат и съвпадащ ключ. Провереният
clientAuth CN е обвързан с единствения pilot controller/node; импортът потвърждава
един polling slot. Точни health/slot-1 ACL и read-only reader. Inventory/bindings/
bundle са частни, извън Git. Worker е пуснат в частните MQTT/backend мрежи с
host UID/GID за 0600 файловете: subscription active, 0 рестарта. Още няма device
записи. activate-rock-mqtt.py проверява cert/key, locked gates, hash/linkage,
архивира и сменя само binary/MQTT env keys с rollback при неуспешен старт.
Проверен syntax, още не е изпълнен на ROCK. Без Ethernet/ESP/OT промени.
Следва копиране на bundle/helper и изпълнение върху готовия staged payload,
после реални DB/UI/ageing проверки. Не пускай стария prepare-mqtt.py: създава
отделен env и разширява node ACL; exact-slot regeneration/auto claim предстоят.

## Heartbeat API deployed / Heartbeat API внедрен — 2026-09-19

Supersedes the API deployment blocker below: live source hashes matched the
parent of the merged heartbeat commit exactly; all unrelated modules matched.
Built this branch and recreated ONLY gridex-api with the existing single env,
Mailgun/vault overlays and volumes. Dirty activation worktree was not changed
or deployed. Image 14acc9c4a3ca; rollback image gridex-api:before-heartbeat-20260919.
API healthy, actual PostgreSQL DeviceHeartbeats.list reads pass, zero records.
Forced-local trusted public-hostname checks: unauthenticated API 401, auth
discovery 200. Synthetic LAN mTLS/ACL acceptance passes again. Not an external
or browser-login acceptance. Worker remains blocked on verified real certificate/
topic bindings. SSH agent has no identities, vault has zero SSH key records,
ROCK BatchMode denies access. Need one-time authenticated device bootstrap;
do not invent device credentials, records or claim the worker is running.
Use standalone docker-compose (docker compose plugin is unavailable here).

Отменя API блокера по-долу: hash-овете на live кода съвпаднаха точно с parent
на merged heartbeat commit; несвързаните модули са еднакви. Изграден този branch
и пресъздаден САМО gridex-api със същия env, Mailgun/vault overlays и volumes.
Dirty activation работата не е променена или внедрена. Image 14acc9c4a3ca;
rollback gridex-api:before-heartbeat-20260919. API healthy; реалните PostgreSQL
DeviceHeartbeats.list заявки минават, 0 записа. Forced-local trusted hostname:
API без token 401, auth discovery 200; синтетичният LAN mTLS/ACL тест пак минава.
Не е външен/browser-login тест. Worker чака проверени реални certificate/topic
bindings. SSH agent няма ключове, vault има 0 SSH записа, ROCK отказва BatchMode.
Нужно е еднократно удостоверено device bootstrap; без измислени credentials/
данни и без твърдение, че worker работи. Ползвай standalone docker-compose.

## Physical MQTT activation and data contract / Реален MQTT и договор — 2026-09-19

Owner requested live deployment plus selectable sensor provisioning specification.
Applied ONLY additive migration 007 using scripts/apply-heartbeat-storage.mjs:
private full database pg_dump, readable archive listing, 8-column table verified,
zero heartbeat rows. Restore rehearsal not performed. No fabricated observations.
Current runtime API lacks device-heartbeats module; worker is not deployed.
Runtime API source points at separate dirty activation worktree: reconcile first,
do not replace that deployment wholesale with this branch and lose its changes.
Registered controller/node counts verified (one each), not proof of connectivity.
ROCK BatchMode SSH still denied; no authenticated upload/remote apply path exists
in this session. Imported MQTT settings missing; preserve existing device keys.
Next requires one-time authenticated device-side inspection of endpoint, public
certificate issuer/CN/fingerprint, configured site/gateway/slot and binary version.
Never request private key/password in chat. Then approve exact broker ACL/bindings,
deploy worker/API, apply Edge config/build and verify real UI receipt end to end.
Full source-based MQTT fields, frontend semantics, configurable sensor proposal,
retention/security and acceptance ledger: docs/MQTT_DEVICE_DATA_SPEC.md.
Validation: 30 backend tests pass (rerun with local sockets after sandbox EPERM);
migration script syntax and git diff whitespace checks pass.

Поискано е реално внедряване и спецификация за избираеми сензори. Приложена е
САМО additive миграция 007 чрез scripts/apply-heartbeat-storage.mjs: частен пълен
pg_dump backup, четим archive listing, проверена таблица с 8 колони и 0 heartbeat
реда. Без restore репетиция и измислени наблюдения. Runtime API няма новия модул,
worker не е внедрен. Runtime source е отделен dirty activation worktree: първо
съпостави, не го подменяй изцяло с този branch. Има един controller и един node,
но това не доказва връзка. ROCK BatchMode SSH отказва; няма удостоверен upload/
apply път в сесията. Вносът няма MQTT настройки; пазят се клиентските ключове.
Следва еднократна локална проверка на endpoint, публичен certificate issuer/CN/
fingerprint, site/gateway/slot и binary версия. Без пароли/private keys в чата.
После точни ACL/bindings, worker/API, Edge config/build и реален UI receipt.
Полета, frontend правила, sensor provisioning, retention/security и acceptance:
docs/MQTT_DEVICE_DATA_SPEC.md.
Проверки: 30 backend теста минават (повторени с local sockets след sandbox EPERM);
script syntax и git diff whitespace проверките минават.

## MQTT LAN TCP ingress / MQTT LAN TCP вход — 2026-09-19

Owner-authorized LAN-only 8883 passthrough deployed; existing broker/client keys
and ACL retained, server certificate LAN SAN added using existing CA/key.
Single backend env; user-login LaunchAgent; no Ethernet/router/VPN/HTTPS changes.
6 relay tests and real synthetic mTLS/ACL acceptance pass. Physical ROCK session
NOT observed; real certificate/topic binding absent from inspected lab inventory.
Worker/migration/browser heartbeat remain pending. Normal-DNS public auth probe
timed out; forced-local public TLS/route checks and local admin checks pass.
Full deployment, limits, rollback and next gates: docs/MQTT_LAN_PROXY.md.

Одобреният LAN TCP 8883 proxy е внедрен; broker/клиентски ключове и ACL запазени,
добавен server LAN SAN със същите CA/key. Един backend env и user-login LaunchAgent;
без Ethernet/router/VPN/HTTPS промени. 6 relay теста и синтетичен mTLS/ACL тест
минават. Физическа ROCK сесия НЕ е наблюдавана; реалният certificate/topic binding
липсва в проверения lab inventory. Worker/миграция/browser heartbeat предстоят.
Public auth normal-DNS probe е timeout; forced-local TLS/routes и local admin
проверките минават. Внедряване, rollback и следващи стъпки: docs/MQTT_LAN_PROXY.md.

## Approved dual transport plan / Одобрен план за два транспорта — 2026-09-19

Owner approval recorded for per-Site WireGuard-private OR direct MQTT-mTLS.
Canonical execution checklist: backend docs/PER_SITE_TRANSPORT_AND_ENROLLMENT.md
on branch docs/per-site-transport. Twelve TODO items cover contract, persistence,
existing broker/worker, ingress, certificate lifecycle, first-boot claim, approved
configuration application, UI, signed firmware, ROCK-initiated ESP OTA, fleet
operations and end-to-end release acceptance. No new menu; no SSH requirement.
This change is documentation only: no listener, runtime env, migration, device
or router changed. Next: versioned transport contract, then persistence/worker.
Heartbeat implementation is merged; physical delivery still needs acceptance.

Записано е одобрение за избор по Обект: WireGuard-private ИЛИ direct MQTT-mTLS.
Каноничният план е backend docs/PER_SITE_TRANSPORT_AND_ENROLLMENT.md в branch
docs/per-site-transport. 12 TODO задачи: договор, база, broker/worker, входове,
сертификати, first-boot claim, одобрено прилагане, UI, подписан firmware, ESP OTA
от ROCK, управление на много обекти и end-to-end приемане. Без ново меню и SSH
зависимост. Само документация: без listener/env/миграция/device/router промени.
Следва versioned transport договор, после база/worker. Heartbeat кодът е слят;
физическата доставка още изисква приемане.

## Device heartbeat integration / Heartbeat интеграция — 2026-09-19

Implemented observation-only mTLS MQTT worker, additive migration 007 and
admin/Site-scoped device-heartbeats API. Backend receipt and successful ESP
poll time are separate; retained/old/duplicate reports do not refresh liveness.
30 Node tests pass, including scope denial. SQL persistence test is mocked.
NOT deployed: migration, real inventory/topic bindings, reader cert mount,
restricted LAN transport (broker still loopback), ROCK binary and browser QA.
Branch feat/device-heartbeat depends on PR #26, not dirty activation WIP.
Next: docs/DEVICE_HEARTBEATS.md checklist; preserve locked writes and VPN off.

Реализирани mTLS MQTT worker само за наблюдение, additive миграция 007 и
admin/Site API. Backend receipt и ESP контакт са отделни; retained/стари/
повторени записи не освежават статуса. 30 Node теста минават; SQL е mock.
НЕ са внедрени: миграция, реални bindings, reader сертификати, ограничен LAN
път (broker е loopback), ROCK binary и browser QA. Branch feat/device-heartbeat
зависи от PR #26, без dirty activation промени. Следва checklist в
docs/DEVICE_HEARTBEATS.md; writes заключени, VPN изключен.

## Existing test config import / Импорт на съществуваща тестова конфигурация

Owner-supplied private ROCK Pi env imported into the existing owning Site.
Exactly two registered gateways matched, no new inventory or hardware writes.
Original encrypted AES-256-GCM in external vault imports with Site/hash AAD;
SQL stores only provenance and sanitized polling/DHCP/commissioning summary.
Repeated import verified idempotent. No SSH credential, Deye driver validation
or live telemetry established. Source proves intended ROCK Pi settings, not
current ESP firmware or physical health. Device UI skips repeat provisioning
for imported pair, offers a separate draft for changes. Private export remains
0600 outside Git; key backup is necessary for encrypted source recovery.
Migration 005 expands configuration section constraint for device-setup/import;
prior memory tests missed this real PostgreSQL restriction. Applied successfully.
Frontend publication/real user acceptance must be verified separately.

Внесен е частният ROCK Pi env към съществуващия Обект на собственика. Намерени
точно два регистрирани gateway записа; без нов inventory/hardware writes.
Оригиналът е AES-256-GCM криптиран във външния vault imports със Site/hash AAD;
SQL съдържа само произход и обезличени polling/DHCP/commissioning данни.
Повторният импорт е проверен без дублиране. Не са добавени SSH credentials,
проверен Deye драйвер или live телеметрия. Файлът доказва ROCK Pi настройки,
не ESP firmware/физическо здраве. UI пропуска повторния provisioning на двойката
и предлага отделна чернова за промени. Частният експорт остава 0600 извън Git;
за възстановяване на криптирания оригинал е нужен backup на ключа.
Миграция 005 разширява section constraint за device-setup/import; предишните
memory тестове са пропуснали това PostgreSQL ограничение. Приложена успешно.
Frontend публикацията и приемането от реалния потребител се проверяват отделно.

## Device setup flow / Настройки на устройства — 2026-09-19

Owner requested all device configuration under Devices, not Profile. Implemented
registered-device dropdown, one/two communication roles, peer selection (backend,
Deye 100 kW, Suntech 261) and transport. Backend enforces verified Site admin,
known gateway, max two roles, no duplicate peer and no direct ESP-to-backend role.
Versioned device-setup configuration is persisted in PostgreSQL with draft
lifecycle, optimistic revision and audit; no new env files or hardware commands.
Only after confirmed save is the controller's protected provisioning/access form
shown. ESP stays DHCP via ROCK Pi; reservation/driver deployment is not implemented.
Equipment labels are planning choices, not proof of compatible drivers or exact
vendor model; commissioning remains required. Existing inventory IDs are reused.
No migration, battery Modbus activation, VPN or credential changes.
Tests: 25 API tests pass, including HTTP admin/scope/revision protection.
Frontend lint/build and null-battery regression pass. API deployment initiated;
UI CI/publication and real browser acceptance must be checked before claiming live.

Настройките са преместени от Профил в Устройства: падащо меню със заведени
устройства, една/две комуникационни роли, партньор (backend, Deye 100 kW,
Suntech 261) и транспорт. Backend проверява потвърден admin на Обекта,
познат gateway, максимум две роли, без дублиран партньор и без директна ESP-backend
роля. Versioned device-setup е в PostgreSQL с draft lifecycle, revision check
и одит; без нов env файл или hardware команди. Едва след потвърден запис се
показва защитената форма за provisioning/достъп на контролера. ESP остава DHCP
през ROCK Pi; прилагане на резервация/driver не е реализирано. Етикетите са
план, не доказан съвместим драйвер/точен модел; commissioning предстои.
Запазени са inventory ID. Без миграции, battery Modbus, VPN или credentials промени.
25 API теста минават, включително HTTP admin/scope/revision защити. Frontend
lint/build и null-battery regression минават. API deployment е стартиран;
UI CI/публикация и реалният browser тест трябва да се проверят преди live твърдение.

## Local admin login repair / Поправка на локалния admin вход — 2026-09-19

Applied master realm frontendUrl from GRIDEX_ADMIN_AUTH_BASE in the single
private env, preserving other realm attributes and public gridex issuer.
Rollback metadata saved privately. No password, proxy ACL, TLS trust or router
change. Verified local discovery, admin authServerUrl and fresh PKCE login form
all use the local admin origin; forced restricted-proxy master probe remains 404.
Actual LAN forwarding target is host port 14443, not 443; LAN TLS probe passed.
Public-domain access from this Mac still times out: external/mobile reachability
and LAN hairpin routing are not proven by these local checks. Earlier diagnosis
based on host port 443 refusal was not valid for this router mapping.
Backend check-auth-routing.mjs provides a read-only regression gate; both AGENTS
require login/logout/expired-session browser acceptance, not just HTTP 200.
Actual password submission and browser session-expiry acceptance remain pending;
no continuous monitoring has been installed.

Приложен master realm frontendUrl от GRIDEX_ADMIN_AUTH_BASE в единния частен env,
със запазени останалите realm attributes и public gridex issuer. Частен rollback
е записан. Без промяна на пароли, proxy ACL, TLS доверие или рутер. Local discovery,
admin authServerUrl и новата PKCE login форма вече ползват локалния admin адрес;
принудителната проба през ограничения proxy за master остава 404.
Реалната LAN цел е host порт 14443, не 443; LAN TLS пробата мина. Публичният домейн
от този Mac още изтича: външен/mobile достъп и LAN hairpin не са доказани с тези
локални проверки. Предишният извод от отказ на host 443 не е валиден за този NAT.
Backend check-auth-routing.mjs е read-only regression проверка; двата AGENTS
изискват browser вход/изход/изтекла сесия, не само HTTP 200. Реално подаване на
парола и browser приемане след изтекла сесия предстоят; няма постоянен монитор.

## Planned: day-ahead net-profit arbitrage / Планирано: арбитраж „ден напред“ — 2026-09-19

Status: requirement recorded, not implemented or activated by this task.
Extend the existing `price_arbitrage` strategy rather than introducing a duplicate.

### English

- [ ] Select/configure the strategy per Site in the frontend, persist a versioned
  configuration in the backend, enforce Site administrator permissions and audit
  approval. Deployment settings remain in the single backend configuration file;
  no hard-coded operational settings or secrets in frontend/Git.
- [ ] Backend jointly optimizes next-day charging and later discharging windows
  for maximum expected **net profit**, not merely the lowest/highest spot price.
  Use published day-ahead intervals, currency/energy units, timezone and DST;
  distinguish actual published prices from forecasts and validate source freshness.
- [ ] Net profit = export revenue minus purchased energy, applicable grid/market
  fees and taxes, and battery degradation cost. Model charge/discharge efficiency
  in the energy balance, without charging losses twice.
- [ ] Configure battery cost per equivalent full cycle (EFC), or an equivalent
  throughput cost with an explicit kWh basis. Allocate partial-cycle wear to each
  dispatch interval and show hourly costs; cycle cost is not an arbitrary fixed
  cost per clock hour. Document the conversion and avoid double-counting wear.
- [ ] Respect initial/final SOC, reserve, usable capacity, charge/discharge power,
  grid import/export limits, cycle budget, availability and the Edge safety
  envelope. Prevent simultaneous charge/discharge; do not schedule trades below
  the configured minimum net margin. Missing/stale prices or telemetry must
  block new automatic dispatch and follow an approved safe fallback.
- [ ] UI displays buy/sell windows, kWh, prices, losses, fees, cycle cost and
  expected net profit by interval and total. Support preview/simulation, explicit
  administrator approval and an audited plan/configuration revision. Compare
  forecasts with actual metered results; predicted profit is not guaranteed.
- [ ] Acceptance: tests for low spread, negative prices, efficiency/degradation,
  partial cycles, SOC/power/reserve limits, DST/missing intervals, stale inputs
  and unauthorized changes; then read-only simulation with real price data.
  Physical battery dispatch remains disabled until separate commissioning and
  approval. No Suntech 261 Modbus activation is authorized by this task.

Next: agree the versioned strategy inputs, cost units and plan API contract,
then implement backend optimization and frontend selection/preview together.

### Български

- [ ] Избор/настройка на стратегията по Обект през frontend, versioned конфигурация
  в backend, права на администратор на Обекта и одит на одобрението. Deployment
  настройките остават в единния backend конфигурационен файл; без hard-coded
  оперативни настройки или тайни във frontend/Git.
- [ ] Backend оптимизира съвместно прозорците за зареждане и последващо разреждане
  за следващия ден за максимална очаквана **нетна печалба**, не само най-ниска/
  най-висока борсова цена. Ползва публикуваните интервали „ден напред“, валута,
  енергийни единици, часова зона и лятно/зимно време; различава реалните публикувани
  цени от прогнози и проверява актуалността на източника.
- [ ] Нетна печалба = приход от продажба минус закупена енергия, приложими
  мрежови/пазарни такси и данъци и износване на батерията. КПД при заряд/разряд
  се отчита в енергийния баланс, без двойно начисляване на загубите.
- [ ] Настройва се цена на еквивалентен пълен цикъл (EFC) или еквивалентна цена
  за преминала енергия с изрична kWh база. Износването от частичните цикли се
  разпределя по интервали и се показва по часове; цената на цикъла не е произволна
  фиксирана такса на астрономически час. Документирана конверсия, без двойно
  начисляване на износването.
- [ ] Спазват се начален/краен SOC, резерв, използваем капацитет, мощности на
  заряд/разряд, мрежови лимити за внос/износ, бюджет цикли, наличност и безопасният
  работен диапазон на Edge. Без едновременен заряд/разряд и сделки под зададения
  минимален нетен марж. Липсващи/стари цени или телеметрия блокират новото
  автоматично управление и задействат предварително одобрено безопасно поведение.
- [ ] UI показва прозорци за покупка/продажба, kWh, цени, загуби, такси, цена на
  цикъла и очаквана нетна печалба по интервал и общо. Преглед/симулация, изрично
  одобрение от администратор и одит на ревизията на плана/конфигурацията.
  Сравнение с реално измерения резултат; прогнозната печалба не е гаранция.
- [ ] Приемане: тестове за малък спред, отрицателни цени, КПД/износване, частични
  цикли, SOC/мощност/резерв, смяна на часа/липсващи интервали, стари входни данни
  и неразрешени промени; после read-only симулация с реални цени. Физическото
  управление остава изключено до отделно commissioning и одобрение. Тази задача
  не разрешава активиране на Modbus към Suntech 261.

Следва: договор за versioned входни параметри, единици за разходите и plan API,
после съвместна реализация на backend оптимизацията и frontend избора/прегледа.

## Protected device access / Защитен достъп до устройства — 2026-09-19

Backend deployed: GET/PUT site gateway access metadata/replacement endpoints.
Verified current site administrator required; foreign Sites rejected, ESP direct
access rejected. Hardware topology/config administration is now admin-only.
Full SSH connection material encrypted AES-256-GCM with Site/gateway/version/time
AAD, stored outside SQL. Separate 0400 master-key volume, read-only API mount;
data directory 0700/files 0600. Single backend .env holds vault path settings.
No secret read HTTP endpoint. Explicit confirmation, optimistic version check,
no-store response and secret-free replacement audit. API tests: 22 pass.

Frontend Profile form implemented, lint/Pages build pass; publication and real
browser acceptance remain pending. Full tsc is blocked by existing gateway,
overview, supported-device, worker and service dependency errors, not new form.
No actual device credential has been saved; no SSH execution, heartbeat worker,
OTA queue or fresh-auth/MFA approval flow exists yet. Key fingerprint is required
as input but not verified against a connection yet; key input is structurally
validated only. Current vault supports one API process (not distributed writers).
Master-key offline encrypted backup/rotation and recovery drill remain mandatory
before production; SQL backup alone cannot restore credentials. Host/API takeover
can expose decrypt capability; this protects database-only leakage, not host
compromise. Demo must never reuse this endpoint or store.

Backend е внедрен: GET/PUT за статус/замяна на достъп по Обект/gateway. Изисква
потвърден текущ администратор; чужд Обект и директен ESP достъп се отказват.
Hardware topology/config администрацията е само за администратор. Целият SSH
достъп е криптиран AES-256-GCM с Site/gateway/version/time AAD извън SQL. Master
ключът е в отделен volume с 0400 и read-only API mount; данни 0700/0600. Пътищата
са в единния .env. Няма secret-read HTTP endpoint. Има изрично потвърждение,
version check, no-store и audit без тайни. 22 API теста минават.

Profile формата е реализирана; lint/Pages build минават, публикация и реален
browser тест предстоят. Пълният tsc е блокиран от съществуващи gateway/overview/
supported/worker/dependency грешки, не от новата форма. Реален credential още не
е записан; няма SSH изпълнение, heartbeat worker, OTA queue или fresh-auth/MFA
одобрение. Fingerprint се изисква, но не е проверен с връзка; key input се
валидира само структурно. Vault е за един API процес, не distributed writers.
Отделен криптиран offline backup/rotation на master key и restore тренировка
са задължителни преди production; SQL backup не възстановява ключовете.
Превзет host/API може да дешифрира; защитата е срещу database-only изтичане.
Демото никога не ползва този endpoint/store.

## Local test inventory / Локален тестов inventory — 2026-09-19

Owner approved a local-only test Site with one ROCK Pi E controller and one
OLIMEX ESP32-EVB lab node, owned through the organization's administrator.
Inventory registered transactionally as commissioning/draft; repeat registration
does not duplicate it. No hardware commands, IP/MAC reassignment, VPN activation,
battery Modbus or physical configuration changes were performed. RS485 battery
port is marked disabled in inventory; this is NOT proof of firmware state.
Demo uses a sanitized illustrative pair, not private inventory IDs or telemetry.
Remaining: publish frontend example, verify authorized topology UI, reconcile
physical identities/config files, ingest heartbeat, then separately implement
opt-in sanitized live demo projection. Other demo simulations are not live data.

Одобрен е локален тестов Обект с един ROCK Pi E контролер и OLIMEX ESP32-EVB
lab нод, собственост чрез администратора на организацията. Inventory е записан
транзакционно като commissioning/draft; повторният старт не го дублира. Няма
хардуерни команди, IP/MAC промени, VPN активация, battery Modbus или физически
конфигурационни промени. RS485 battery портът е disabled в inventory — това НЕ
доказва firmware състоянието. Демото използва обезличена примерна двойка, не
частни ID или телеметрия. Остават публикуване на frontend примера, проверка на
удостоверения topology UI, сверяване на физически identity/config файлове,
heartbeat приемане и отделна opt-in обезличена live demo проекция. Останалите
демо симулации не са реални данни.

## Proxy DNS recovery / Възстановяване на proxy DNS — 2026-09-19

After Keycloak/API recreation, nginx retained startup upstream IPs and sent
auth requests to API (discovery returned authentication_required; login POST
returned origin_not_allowed). Fixed template and live proxy with Docker DNS
resolver, 5-second validity and variable proxy_pass without a URI suffix,
preserving request path/query. nginx validation/reload passed; discovery now
returns the correct issuer. API allowed-origin unauthenticated request returns
401; foreign origin 403; public admin/master/health paths 404. No CORS relaxation.
Owner reports password setup completed; fresh browser login remains to confirm.
Start from the portal, not an old session_code URL. Recreate/IP-churn regression
test remains pending; no deliberate production disruption for that test.

След пресъздаване на Keycloak/API nginx запази стартовите upstream IP адреси и
пращаше auth към API: discovery връщаше authentication_required, login POST —
origin_not_allowed. Поправени template и live proxy с Docker DNS resolver,
валидност 5 секунди и variable proxy_pass без URI суфикс, запазващ path/query.
nginx validation/reload преминаха; discovery връща правилния issuer. API без
идентификация от разрешен origin връща 401, чужд origin 403, публичните admin/
master/health пътища 404. Без разширяване на CORS. Собственикът потвърди зададена
парола; новият browser вход чака проверка. Започни от портала, не от стар session
линк. Recreate/IP-churn regression тестът предстои, без умишлено прекъсване сега.

## Email enrollment deployed / Email регистрация внедрена — 2026-09-19

Supersedes earlier Mailgun preparation blockers below. Single private `.env`
consolidated with rollback; duplicate runtime env inputs retired. Configurable
`GRIDEX_MAILGUN_BCC` applies to both Node transport and Keycloak Mailgun HTTP
provider, including sensitive verification/password links (owner explicitly
requested this). Provider compiled against installed 26.7.3; Keycloak/API
recreated healthy, enrollment enabled, physical writes still disabled. Initial
organization and owner administrator created with user-required email/password
actions. One actual registration email accepted; queued audit recorded. No
password assigned by operator, no email verification bypass, no public signup,
no extra public ports. Dedicated realm enrollment client, not master credentials
in API. Private database/config backups exist; restore not acceptance-tested.

Next acceptance, in order: recipient confirms inbox/BCC delivery and completes
verification/password; real portal PKCE login and organization visibility; own/
foreign Site authorization; second-user invite/accept/revoke; logout/password
reset. Do not mark these completed merely from provider acceptance. Delivery/
bounce webhooks and durable application-mail outbox remain future work; current
transport deliberately does not retry uncertain sends. Deployment/recreation:
`compose.mac.yml` + `compose.mailgun.yml`, single private `.env`; see
`docs/MAILGUN_API.md`. Retired env files must not be reintroduced.

Заменя по-старите Mailgun blockers по-долу. Единният частен `.env` е обединен с
rollback; дублираните env входове са извадени от употреба. `GRIDEX_MAILGUN_BCC`
важи за Node и Keycloak Mailgun HTTP, включително чувствителни verify/password
връзки — изрично поискано от собственика. Provider е компилиран за инсталирания
26.7.3; Keycloak/API са пресъздадени healthy, enrollment е включен, физическите
записи остават изключени. Създадени начална организация и owner administrator с
лични email/password действия. Едно истинско регистрационно писмо е прието,
queued audit е записан. Без зададена от оператора парола, без bypass на email
потвърждението, публична регистрация или допълнителни публични портове. Отделен
realm enrollment клиент; API не получава master credential. Има частни backups
на базите/конфигурацията; restore не е acceptance-тестван.

Следва по ред: получателят потвърждава inbox/BCC и завършва email/password;
реален portal PKCE вход и организация; права за собствен/чужд Обект; покана/
приемане/отнемане на втори user; изход/reset password. Provider acceptance не
доказва тези стъпки. Delivery/bounce webhooks и трайна application-mail опашка
остават бъдещи; няма автоматичен retry на неясни изпращания. Внедряване:
`compose.mac.yml` + `compose.mailgun.yml`, единният `.env`; виж
`docs/MAILGUN_API.md`. Старите env файлове не се връщат в употреба.

## First delivery probe / Първа проба за доставка — 2026-09-19

One owner-authorized real test email was submitted through Mailgun using the
single private `.env`; provider returned `queued` and a message ID. Inbox
delivery is not yet confirmed. This was not a registration invitation and
grants no access. Live diagnostics: enrollment disabled, enrollment client
absent from active API, organisations table empty. Next: owner organization/
initial role decision, Keycloak HTTP email integration, enrollment provisioning
and actual verification/password action link. No account/membership created.

Едно одобрено от собственика реално тестово писмо е подадено през Mailgun с
единния частен `.env`; доставчикът върна `queued` и message ID. Доставката в
пощата още не е потвърдена. Това не е покана за регистрация и не дава достъп.
Live проверката показва изключен enrollment, липсващ enrollment клиент в активния
API и празна таблица organisations. Следва избор на организация/начална роля,
Keycloak HTTP email интеграция, enrollment provisioning и истинска връзка за
потвърждение/парола. Няма създаден профил или членство.

## Mailgun API test accepted / Mailgun API тест приет — 2026-09-19

Owner installed a replacement sending key in the single private backend `.env`.
Approved region/domain/from were added there. A real provider request with
`o:testmode=yes` returned `test_accepted` and a message ID. The key was not
printed. No email was delivered; DNS acceptance, inbox delivery, container
wiring and Keycloak invitation integration are not proven by this host test.
Older duplicate config files still need consolidation; no restart performed.

Собственикът постави заменен sending ключ в единния частен backend `.env`.
Одобрените region/domain/from са добавени там. Реална заявка към доставчика с
`o:testmode=yes` върна `test_accepted` и message ID. Ключът не е отпечатван.
Няма доставено писмо; DNS приемане, доставка в пощата, container свързване и
Keycloak покани не са доказани от този host тест. Старите дублирани config
файлове още изискват обединяване; няма извършен рестарт.

## Single configuration decision / Решение за една конфигурация — 2026-09-19

Mandatory future rule is in AGENTS.md: `~/GrideX-runtime/backend/.env` is the
only operator-maintained backend configuration, including Mailgun credentials.
This supersedes earlier Keychain/separate Mailgun env setup instructions.
Consolidation is NOT applied by this documentation change. Next, back up private
settings; combine `.env`, `public-oidc.env` and `mailgun.env`, resolving duplicate
keys explicitly; update Compose and setup/test invocations to use only `.env`;
verify OIDC/API/Mailgun settings without printing secrets; then retire obsolete
inputs after successful checks, preserving private rollback. Keep mode 0600 and
per-service credential scoping. No service restart or credential change here.

Задължителното правило за бъдеща работа е в AGENTS.md:
`~/GrideX-runtime/backend/.env` е единствената поддържана от оператора backend
конфигурация, включително Mailgun credentials. То заменя предходните указания
за Keychain/отделен Mailgun env файл. Обединяването НЕ е приложено с тази
документация. Следва частен backup; обединяване на `.env`, `public-oidc.env` и
`mailgun.env` с изрично разрешаване на дублирани ключове; обновяване на Compose
и setup/test командите да четат само `.env`; проверка на OIDC/API/Mailgun без
извеждане на тайни; после изваждане на старите входни файлове от употреба след
успешни проверки и със запазен частен rollback. Права 0600 и credentials само
за нужната услуга. Тук няма рестарт на услуги или промяна на credentials.

## Mailgun transport prepared / Mailgun транспорт подготвен — 2026-09-19

Added REST transport, tests and private host test CLI; see docs/MAILGUN_API.md.
Approved domain/region/from configured outside Git. Disclosed key was not saved:
approval review rejected persistence. A replacement key in Keychain and DNS
verification are needed for live testing. Keycloak email-provider integration
and enrollment activation remain unfinished; no invitation sent or user created.

Добавени REST транспорт, тестове и частен host test CLI; виж docs/MAILGUN_API.md.
Одобрените domain/region/from са настроени извън Git. Публикуваният ключ не е
записан: approval проверката отказа записа. Нужни са заменен ключ в Keychain
и DNS проверка за реален тест. Keycloak email-provider интеграцията и enrollment
активирането остават незавършени; няма изпратена покана или създаден user.

## Public ingress + OIDC hostname update / Публичен ingress + OIDC hostname — 2026-09-18

External HTTPS ingress is now proven: the restricted proxy returns the expected
unauthenticated API response from an independent Internet connection. Only TCP
443 is forwarded; Docker services remain loopback/internal and the proxy still
denies Keycloak administration, OpenRemote Manager, databases, MQTT, health and
metrics. The real router/Mac addresses, DMZ details, certificates and keys are
private operational data and must not be added to Git.

Keycloak and `gridex-api` were restarted together with a public auth hostname.
The verified discovery issuer and API issuer are now
`https://auth.gridex.tech/auth/realms/gridex`; internal JWKS/token traffic stays
on the Compose network. The frontend no longer calls the intentionally private
`/health` endpoint before it starts OIDC. Its published runtime defaults now
target `auth.gridex.tech`.

The exact `gridex-portal` Keycloak callback allow-list was applied from the Mac
host using `scripts/apply-public-oidc.sh`; its private rollback snapshot is
outside Git. The approved `https://gridex.tech` root, `/en/` and silent-SSO
callbacks return a Keycloak login form; a foreign callback returns HTTP 400.
The helper neither prints nor stores the password. Next, test browser login with
an ordinary Gridex user, empty membership, own/foreign site access and logout
before declaring user authentication complete.

Външният HTTPS ingress вече е доказан: ограниченият proxy връща очаквания API
отговор без удостоверяване от независима Internet връзка. Пренасочен е само TCP
443; Docker услугите остават loopback/internal, а proxy продължава да отказва
Keycloak администрация, OpenRemote Manager, бази, MQTT, health и metrics.
Реалните адреси/DMZ, сертификатите и ключовете са частни оперативни данни и не
се добавят в Git.

Keycloak и `gridex-api` бяха рестартирани заедно с публично auth име. Провереният
discovery issuer и API issuer са
`https://auth.gridex.tech/auth/realms/gridex`; вътрешните JWKS/token заявки
остават в Compose мрежата. Frontend вече не извиква умишлено частния `/health`
преди OIDC и публикуваните му runtime defaults сочат `auth.gridex.tech`.

Точният callback allow-list на Keycloak клиента `gridex-portal` е приложен от
Mac host чрез `scripts/apply-public-oidc.sh`; частният му rollback snapshot е
извън Git. Одобрените `https://gridex.tech` root, `/en/` и silent-SSO callbacks
връщат Keycloak login форма, а чужд callback връща HTTP 400. Инструментът не
отпечатва и не запазва паролата. Следва browser вход с обикновен Gridex user,
липсващо членство, собствен/чужд обект и logout преди да се твърди завършена
user автентикация.

## Router connectivity test / Тест през рутера — 2026-09-16

Owner approved and agent applied TCP 443 forwarding to the restricted HTTPS
proxy host port 14443; saved rule verified after UI reload. Docker remains
loopback-only. A temporary SSH local forward binds only the approved Ethernet
address, through the existing Colima SSH connection; it is NOT reboot-persistent.
LAN and router private-WAN HTTPS probes both returned 401 from API me, with
matching proxy log entries and normal certificate validation. Public-address
probe from inside LAN timed out; independent mobile-data test is still required.
This proves router-to-proxy connectivity, NOT external ingress or browser login.
No VPN, database, MQTT or administrative ports exposed. Router warns of a weak
admin password: owner must change it privately. Next: external probe, persistent
interface-scoped ingress design, then resume OIDC/login commissioning below.

Собственикът одобри и агентът приложи TCP 443 към порт 14443 на ограничения
HTTPS proxy; правилото е проверено след UI reload. Docker остава loopback-only.
Временно SSH препращане слуша само на одобрения Ethernet адрес през съществуващата
Colima SSH връзка; НЕ се възстановява автоматично след рестарт. HTTPS пробите
през LAN и частния WAN адрес на рутера върнаха 401 от API me с потвърждение в
proxy логовете и нормална проверка на сертификата. Пробата към публичния адрес
от LAN изтече; остава независим тест през мобилни данни. Доказан е пътят
рутер–proxy, НЕ външен достъп или browser вход. Без отворени VPN, database,
MQTT или административни портове. Рутерът предупреждава за слаба admin парола:
собственикът трябва да я смени лично. Следва външен тест, постоянен ingress само
на избрания интерфейс и OIDC/login приемане по-долу.

## Current execution queue / Актуална последователност — 2026-09-16

### English

This section supersedes historical waiting-for-DNS/certificate and stopped-host
notes below. Last verified: approved API/auth DNS resolves; Colima and backend
recovered, MQTT mTLS is locally tested; trusted HTTPS certificate is installed
on loopback 14443, expiring 2026-12-15. Eight TLS route tests passed, not a full
public-login/security audit. Public 443 is NOT commissioned; WireGuard is OFF.
GitHub Pages frontend merges do not prove that the live backend login works.
User reported a router DHCP reservation for the Mac; current router reservation
and inbound forwarding must still be checked before exposure. Real deployment
addresses and keys remain in private runtime/configuration, not this repository.

Execute in this order; none of these six complete milestones is accepted yet:

1. **OIDC/API configuration — pending (backend).** Set approved public Keycloak
   hostname and matching API issuer, preserve internal JWKS/token endpoints and
   private administration. Exact frontend origin, login/silent-SSO/logout callbacks;
   no wildcard origins. Keep enrollment and physical-control safety gates closed.
2. **Local integration acceptance — pending (backend + frontend).** Replace the
   frontend dependency on public /health with reviewed authenticated readiness,
   without an auth/readiness circular dependency. Prove real browser login/logout,
   ordinary user/empty membership, own/foreign site access and stale-token
   revocation. Retest admin/master/health/metrics denial, path normalization,
   CORS, untrusted forwarded headers and TLS without insecure overrides.
3. **Public ingress — pending (backend + owner/router).** Only after local tests,
   bind the dedicated restricted proxy on approved host TCP 443, validate Colima
   forwarding and use EdgeOS WAN eth0/LAN br0 to forward TCP 443 to the reserved
   Mac LAN address:443. Never forward to existing OpenRemote localhost:8443.
   No database, MQTT, Portainer, SSH or Modbus public forwards. Verify reachability
   from a genuinely external network; same-LAN hairpin is not sufficient evidence.
4. **GitHub Pages live test — pending (`antouanbg/gridex-energy-os`).** Update only
   approved public API/OIDC runtime URLs after endpoint checks, build/test/review,
   PR/merge and confirm Pages deployment. Preserve apex/www hosting and mobile
   layout. Test actual public sign-in and per-site permissions from outside LAN.
5. **Certificate lifecycle — pending (backend + DNS provider).** Existing manual
   DNS-01 issuance does not auto-renew. Determine DNS API support with least-
   privilege credentials, or delegate only ACME challenge names for automation;
   no need to move website/mail DNS. Automate issuance, secure installation,
   nginx validation/reload, expiry/failure alerting, and prove renewal. No claim
   that this automation or a reminder is already scheduled. Until then renew
   manually well before 2026-12-15. A longer purchase term is not a longer-lived
   individual certificate; do not replace trusted TLS with a long self-signed one.
6. **Email + real telemetry — pending (cross-repository).** Continue Mailgun REST
   invitation/verification/recovery delivery and membership-management plan;
   no SMTP substitution. Real ROCK Pi mTLS identity and PostgreSQL/OpenRemote
   ingestion remain separate from successful synthetic broker tests. Follow
   ACCESS_MANAGEMENT_PLAN.md and Edge handoff in `antouanbg/gridex-edge-gateway`.

WireGuard activation is a separate owner gate AFTER ROCK Pi relocation: peer is
Site Router, not ROCK Pi/ESP. Isolate only selected MQTT/future approved OTA paths;
no site-to-site, whole-backend VPN routing or Mac default-route changes.
Backup/full restore and actual host reboot/login-start acceptance also remain.
Exact next action: inspect current private OIDC/runtime settings read-only, back
up settings, then implement step 1 and step 2 without opening router ports.

### Български

Този раздел заменя старите бележки за чакащи DNS/сертификат и спрян host.
Последно проверено: API/auth DNS работи; Colima/backend са възстановени; MQTT
mTLS е локално тестван; довереният HTTPS сертификат е на loopback 14443 до
2026-12-15. Осем TLS route теста минаха, но това не е пълен публичен login/security
одит. Публичен 443 НЕ е въведен в експлоатация; WireGuard е ИЗКЛЮЧЕН. Merge на
GitHub Pages не доказва работещ реален вход. Собственикът съобщи DHCP резервация
за Mac; актуалната резервация и входящият NAT трябва да се проверят преди
публикуване. Реалните адреси/ключове остават в частната конфигурация, не в Git.

Изпълнение по ред; нито един от шестте пълни етапа още не е приет:

1. **OIDC/API — предстои (backend).** Одобрен публичен Keycloak hostname и
   съвпадащ API issuer; запазени вътрешни JWKS/token endpoints и частен admin.
   Точни frontend origin/login/silent-SSO/logout callbacks, без wildcard origins.
   Enrollment и предпазните ограничения за физическо управление остават затворени.
2. **Локално приемане — предстои (backend + frontend).** Замени зависимостта от
   публичен /health с прегледана автентикирана readiness проверка, без цикъл
   между auth и readiness. Докажи browser вход/изход, обикновен user/липсващо
   членство, свои/чужди обекти и отнемане на права при стар token. Повтори отказите
   за admin/master/health/metrics, path normalization, CORS, подправени forwarded
   headers и TLS без изключване на проверките.
3. **Публичен ingress — предстои (backend + собственик/рутер).** След локалните
   тестове: отделният ограничен proxy на одобрен host TCP 443, проверен Colima
   forwarding, EdgeOS WAN eth0/LAN br0: TCP 443 към резервирания Mac LAN адрес:443.
   Не към стария OpenRemote localhost:8443. Без публични база/MQTT/Portainer/SSH/
   Modbus портове. Тествай от действително външна мрежа; LAN hairpin не е доказателство.
4. **GitHub Pages live тест — предстои (`antouanbg/gridex-energy-os`).** След
   проверка на endpoints обнови само одобрените API/OIDC URLs, build/test/review,
   PR/merge и потвърден Pages deployment. Запази apex/www hosting и mobile layout.
   Провери истински публичен вход и права по обекти отвън.
5. **Сертификат — предстои (backend + DNS доставчик).** Ръчният DNS-01 няма
   auto-renewal. Провери DNS API с минимални права или делегиране само на ACME
   challenge имената; сайтът/пощата не се местят. Автоматизирай издаване, сигурно
   инсталиране, nginx validate/reload, известяване за срок/грешки и докажи renewal.
   Няма настроена автоматизация или напомняне. Дотогава поднови ръчно достатъчно
   преди 2026-12-15. По-дълъг абонамент не удължава отделния сертификат; не заменяй
   доверения TLS с дългосрочен самоподписан сертификат.
6. **Имейл и реална телеметрия — предстои (между репотата).** Продължи Mailgun
   REST покани/верификация/възстановяване и плана за членства, без SMTP замяна.
   Реалният ROCK Pi mTLS и ingestion към PostgreSQL/OpenRemote са отделни от
   синтетичните MQTT тестове. Следвай ACCESS_MANAGEMENT_PLAN.md и Edge handoff
   в `antouanbg/gridex-edge-gateway`.

WireGuard се активира отделно СЛЕД преместване на ROCK Pi и разрешение: peer е
Site Router, не ROCK Pi/ESP. Само избрани MQTT/бъдещи одобрени OTA пътища; без
Site-to-Site, VPN за целия backend или промяна на Mac default route.
Backup/full restore и реален reboot/login-start тест също остават.
Точно следващо: read-only преглед на частните OIDC/runtime настройки, backup,
после т. 1 и 2 без отваряне на портове на рутера.

## Trusted certificate / Доверен сертификат — 2026-09-16

Both approved API/auth hosts now have a Let's Encrypt certificate, expiry
2026-12-15. Installed in existing loopback 14443 proxy; old test pair backed up.
nginx -t and eight real TLS route tests pass with default system CA trust.
No external reachability or browser-login claim. DNS manual issuance has NO
automatic renewal; schedule operational renewal before expiry, securely copy
renewed pair into proxy certs, validate nginx and reload. ACME keys/config stay
under private GrideX-runtime/acme, never Git. Public 443/OIDC commissioning remains.

Двата одобрени API/auth домейна имат Let's Encrypt сертификат до 2026-12-15.
Инсталиран на loopback 14443 proxy; старият тестов чифт е архивиран. nginx -t
и осем TLS route теста минават със стандартното CA доверие. Външен достъп и
browser login не са доказани. Ръчното DNS издаване НЯМА auto-renewal; поднови
преди срока, копирай сигурно новия чифт, провери nginx и reload-ни. ACME ключовете
са в частния GrideX-runtime/acme, не Git. Публичен 443/OIDC още предстои.

## HTTPS test proxy / HTTPS тестов proxy — 2026-09-15

scripts/prepare-public-https.py creates private loopback-only 14443 runtime and
7-day self-signed TEST certificate, never a public certificate. nginx -t and
8 TLS route tests passed (API 401, discovery 200; restricted paths 404).
Waiting for ACME contact email and manual DNS TXT validation. DNS-01 avoids
opening 80; manual certificates require manual renewal unless DNS automation
is configured. Public 443 and OIDC hostname changes remain unapplied.

scripts/prepare-public-https.py създава частна loopback 14443 среда и 7-дневен
самоподписан ТЕСТОВ сертификат, не публичен. nginx -t и 8 TLS route теста минаха
(API 401, discovery 200, забранени пътища 404). Чакаме ACME имейл и ръчни DNS TXT.
DNS-01 не отваря 80; подновяването е ръчно без DNS автоматизация. Публичен 443
и OIDC hostname промените още не са приложени.

## Recovery update / Възстановяване — 2026-09-15

Colima gridex resumed after host reboot; containers recovered using existing
restart policies. api/auth DNS now resolves. Login startup: install
deploy/macos/tech.gridex.colima.plist under the user's Library/LaunchAgents and
bootstrap with launchctl in that user's GUI domain. Runs once at login; does not
override an intentional later stop. Requires user login/FileVault unlock after
reboot, not unattended pre-login startup. Real reboot acceptance remains pending.
Uninstall by bootout of tech.gridex.colima and removing only its plist; volumes
remain. Public TLS/ingress still pending; older stopped/DNS notes are historical.

Colima gridex е възстановен след reboot; контейнерите тръгнаха със съществуващите
restart policies. api/auth DNS вече работи. За старт при вход: инсталира се
deploy/macos/tech.gridex.colima.plist в потребителския Library/LaunchAgents и
launchctl bootstrap в неговия GUI domain. Изпълнява се веднъж при вход, не отменя
последващо умишлено спиране. След reboot е нужен login/FileVault unlock; не е
автоматичен старт преди login. Реален reboot тест предстои. Премахване: bootout
на tech.gridex.colima и само неговия plist, без volumes. TLS/ingress предстои;
старите бележки за спрян runtime/липсващ DNS са исторически.

## Public HTTPS blocked / Публичен HTTPS блокиран — 2026-09-15

Prepared separate restricted API/auth TLS proxy templates; not deployed.
See [public HTTPS handoff](docs/PUBLIC_HTTPS_HANDOFF.md). Colima is stopped and
API/auth DNS has no A answers. Need certificates, runtime validation, OIDC/CORS
configuration and authenticated frontend readiness before GitHub Pages deployment.
No public ports, router/DNS, existing runtime or frontend changes made.

Подготвени отделни ограничени API/auth TLS proxy шаблони, без deployment.
Виж [публичен HTTPS](docs/PUBLIC_HTTPS_HANDOFF.md). Colima е спрян, API/auth DNS
няма A отговори. Нужни са сертификати, runtime тест, OIDC/CORS и автентикирана
frontend проверка преди GitHub Pages deployment. Без промени по публични портове,
рутер/DNS, съществуваща среда или frontend.

## WireGuard: prepared, NOT active / Подготвен, НЕ активен

2026-09-15: [Selective VPN plan](docs/WIREGUARD_ISOLATION_PREPARED.md) and
deploy/wireguard templates added. No runtime changes or keys generated. Activation
requires owner confirmation after ROCK Pi relocation. Kernel/image selection,
UDP path, deny-default firewall, TCP relay, VPN SAN and live tests remain.
Do not route all containers or change Mac Ethernet. This work builds on PR #22.

2026-09-15: Добавени [изолиран VPN план](docs/WIREGUARD_ISOLATION_PREPARED.md)
и deploy/wireguard шаблони. Без runtime промени/ключове. Активиране само след
потвърждение от собственика след преместване на ROCK Pi. Остават kernel/image,
UDP път, firewall, TCP препращане, VPN SAN и реални тестове. Без общ VPN за
контейнерите или промени в Mac Ethernet. Стъпва върху PR #22.

## MQTT mTLS deployment / MQTT mTLS внедряване — 2026-09-15

Local broker implemented, deployed and synthetically tested. Operational guide,
ACL ownership, private runtime, limits and remaining work:
[MQTT TLS](docs/MQTT_TLS_LOCAL.md). Only loopback 8883 is published. Separate
certificates identify sites; backend-reader cannot publish, sites cannot access
foreign topics or commands. Restart/persistent retained delivery passed.
Remaining: real gateway enrollment, Site Router VPN-only transport, backend
ingestion/PostgreSQL/OpenRemote, certificate renewal/revocation and backup drills.
No real hardware or database ingestion is claimed. Do not expose the listener
to LAN/public Internet as a shortcut. Historical checkpoints below are retained.

Локалният broker е реализиран, внедрен и синтетично тестван. Инструкции,
ACL отговорности, частна среда, ограничения и оставащи задачи:
[MQTT TLS](docs/MQTT_TLS_LOCAL.md). Публикуван е само loopback 8883. Отделни
сертификати идентифицират обектите; backend-reader не публикува, обектите нямат
достъп до чужди topics или команди. Рестарт/retained доставка минаха.
Остават: реални gateway идентичности, Site Router VPN транспорт, backend
ingestion/PostgreSQL/OpenRemote, подновяване/отмяна на сертификати и backup тест.
Реална хардуерна доставка или ingestion не са доказани. Не отваряй listener-а
към LAN/Internet като обходен път. Историческите checkpoints са запазени по-долу.

## Email enrollment foundation / Основа за регистрация — 2026-09-15

See [email enrollment](docs/EMAIL_ENROLLMENT.md). Backend invitation routes,
Keycloak adapter and database-scoped permissions implemented, disabled until
commissioned. Tests: 16 passing; disposable PostgreSQL acceptance/replay/revoke/
expiry tests passed with fake identity/email. Image built, active API not updated.
Live migration/restart was blocked by safety review; explicit owner approval
required. Do not claim real registration. SMTP settings and dedicated enrollment
service client missing. `antouanbg/gridex-energy-os`: invitation/acceptance forms
and real browser login remain; membership management and abuse limits remain.
This branch depends on local callback fix PR #18. No automatic merge.

Виж [регистрация](docs/EMAIL_ENROLLMENT.md). Добавени backend маршрути за покани,
Keycloak адаптер и права от базата; функцията остава изключена. 16 теста минаха;
отделна PostgreSQL база доказа приемане/replay/отмяна/срок със симулиран имейл.
Image е билднат, активният API не е обновен. Защитната проверка блокира live
миграции/restart; нужно е изрично одобрение. Реална регистрация не е доказана.
Липсват SMTP и отделен enrollment клиент. За `antouanbg/gridex-energy-os` остават
форми за покана/приемане и реален browser вход; управление на членства и
ограничения срещу злоупотреба също предстоят. Зависи от PR #18. Без auto-merge.

## Local portal login / Локален вход — 2026-09-14

The portal on http://127.0.0.1:4173/ was rejected with invalid redirect_uri.
Provisioning now allows exact root, /en/ and /silent-check-sso.html callbacks
and that web origin; Compose API CORS matches. Applied locally with credentials
and databases preserved. scripts/test-mac-portal-redirect.mjs tests login forms
and rejection of a foreign host; this is not a completed browser login test.
Next: fresh portal login, ordinary gridex user and organization/site permissions.
Master-realm admin is not automatically a gridex user. Certificate trust remains
browser-specific. Backup continuation, MQTT/TLS and WireGuard are deferred.

Порталът на http://127.0.0.1:4173/ беше отказван с invalid redirect_uri.
Provisioning вече разрешава точните root, /en/ и /silent-check-sso.html callbacks
и web origin; Compose API CORS съвпада. Приложено локално със запазени пароли
и бази. scripts/test-mac-portal-redirect.mjs проверява формите и отказа на чужд
host; това не е завършен browser login тест. Следва нов вход от портала,
обикновен gridex потребител и права по организации/обекти. Master admin не е
автоматично gridex потребител. Certificate trust зависи от браузъра.
Продължението на backup, MQTT/TLS и WireGuard е отложено.

## Port update / Промяна на порт — 2026-09-14

Owner requested OpenRemote on https://localhost:8443/. Compose now publishes
only 8443 for proxy; Keycloak hostname, Manager SSL port, forwarded port, API
issuer/origin and portal callbacks use 8443. Portainer remains on 9443.
Previous localhost:443 references are historical. Self-signed certificate
trust still requires owner action; a port change does not resolve trust.

По искане на собственика OpenRemote е на https://localhost:8443/. Compose
публикува само 8443 за proxy; Keycloak hostname, Manager SSL port, forwarded
port, API issuer/origin и portal callbacks ползват 8443. Portainer остава 9443.
Старите localhost:443 адреси са исторически. Self-signed сертификатът още
изисква доверие от собственика; новият порт не решава това автоматично.

## Current acceptance / Актуално приемане

[Authoritative runtime acceptance matrix](docs/MAC_RUNTIME_ACCEPTANCE.md):
real API tenant tests passed; owner confirmed Portainer. Browser PKCE login,
VPN, MQTT receipt and backup/restore remain pending. This supersedes older
pending OIDC provisioning and Portainer setup notes below.

[Актуална runtime матрица](docs/MAC_RUNTIME_ACCEPTANCE.md): реалните API tenant
тестове минаха; собственикът потвърди Portainer. Browser PKCE вход, VPN, MQTT
получаване и backup/restore предстоят. Заменя старите бележки по-долу за
предстоящо OIDC provisioning и Portainer setup.

### Portainer / Portainer — 2026-09-14

Installed Portainer CE 2.45.0 ARM64, container gridex-portainer, published only
on https://localhost:9443. Docker socket access grants administrative control
of the VM engine; never publish this UI to LAN/Internet. Persistent named volume
gridex-portainer-data. Installed with docker run; compose.portainer.yml is its
reproduction definition, not yet the container's Compose owner. Do not run it
over the same named container without a controlled migration preserving data.
Browser blocked by self-signed certificate; owner must handle the warning and
initial admin credential setup. Container-list UI not yet verified. Backend
real no-token and invalid-token checks performed; browser login and site-rights
acceptance remain next, followed by VPN, MQTT and backup/restore.

Инсталиран Portainer CE 2.45.0 ARM64, gridex-portainer, само на
https://localhost:9443. Docker socket дава административен контрол върху VM
engine; UI не се публикува към LAN/Интернет. Named volume gridex-portainer-data.
Инсталиран с docker run; compose.portainer.yml описва възпроизвеждането, но още
не управлява контейнера. Не го стартирай върху същото име без контролирана
миграция със запазени данни. Browser е блокиран от self-signed сертификата;
собственикът трябва да обработи предупреждението и първоначалната admin парола.
Container-list UI още не е проверен. Изпълнени са реални no-token/invalid-token
API проби; следват browser вход и права по обекти, после VPN, MQTT и backup/restore.

### OIDC update / OIDC обновяване — 2026-09-14

Realm and PKCE portal/service clients now exist. Service-account Asset query
passed with read:assets only. No write permission granted; temporary bootstrap
client removed. Next: browser login and tenant isolation acceptance. Earlier
client-provisioning pending notes are superseded, not browser acceptance.

Realm и PKCE portal/service клиенти вече съществуват. Service-account Asset
заявката мина само с read:assets. Без write права; временният bootstrap клиент
е изтрит. Следва browser вход и tenant isolation приемане. Старите бележки за
предстоящо създаване на клиенти са заменени, но browser тестовете остават.

## Latest checkpoint / Последна проверка — 2026-09-14

[Runtime results and remaining work](docs/MAC_RUNTIME_CHECKPOINT.md) supersede
the not-installed baseline below. Six healthy containers; OIDC acceptance,
VPN and backup/restore pending. Edge follow-up belongs to
`antouanbg/gridex-edge-gateway`: journal permissions and ESP Modbus timeout.

[Runtime резултати и оставащо](docs/MAC_RUNTIME_CHECKPOINT.md) заменят стария
неинсталиран baseline по-долу. Шест healthy контейнера; OIDC приемане, VPN и
backup/restore предстоят. Edge задачите са за `antouanbg/gridex-edge-gateway`:
journal права и ESP Modbus timeout.

## English

### Active: Linux under macOS, Windows experiments stopped

- Owner decision: 2026-09-14. [Mac/Linux handoff](docs/MAC_LINUX_HANDOFF.md)
  defines Colima ARM64, candidate versions/digests and six ordered milestones.
- Evidence: M4 Pro/64 GB; six upstream ARM64 images exist; no Docker runtime
  installed or tested. 0/6 implementation milestones complete, 6 pending.
- Dependencies: Colima/Engine, private local storage, staging override and
  API/OIDC/migration fixes; all six runtime tests and restore remain pending.
- Next action: install and verify the dedicated Colima profile, then implement
  isolated staging; do not run base Compose directly or resume Windows/cloud PRs.
- Keep recovery work below and PR #9 backlog; metadata checks are not deployment.

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

### Активно: Linux под macOS, Windows експериментите спират

- Решение от 2026-09-14. [Mac/Linux handoff](docs/MAC_LINUX_HANDOFF.md) определя
  Colima ARM64, candidate версии/digests и шест последователни етапа.
- Доказателства: M4 Pro/64 GB; шест ARM64 images съществуват; Docker не е
  инсталиран/тестван. Завършени implementation етапи 0/6, оставащи 6.
- Зависимости: Colima/Engine, private storage, staging override,
  API/OIDC/migration fixes; runtime тестовете и restore предстоят.
- Следва: инсталиране и проверка на отделния Colima profile, после изолиран
  staging; без директен base Compose старт или продължаване на Windows/cloud PR-и.
- Запазват се recovery задачите по-долу и backlog PR #9; metadata не е deployment.

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
