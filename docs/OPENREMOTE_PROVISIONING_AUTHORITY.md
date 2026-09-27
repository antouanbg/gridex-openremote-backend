# OpenRemote provisioning authority / Основен регистър

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## Customer Site and approved gateway path — local implementation, 2026-09-27

The owner approved new customer Site and device creation from the existing
GrideX screens. The local API now prepares `POST /api/v1/sites` and
`POST /api/v1/sites/:siteId/gateways` for the verified organisation
administrator only. The latter accepts ROCK Pi E or the two confirmed OLIMEX
ESP32-EVB variants; an ESP32 must name the Site's ROCK Pi parent. Both calls
require a stable `Idempotency-Key`. A durable SQL intent is workflow state,
not active inventory. The authenticated organisation realm and OpenRemote
asset/user links are checked before a local read projection is completed.
Retries recover an existing asset by its stable `gridexResourceId`, without
blind deletion or another asset. New customer calls cannot use the legacy
local-first `/hardware-configurations` or `/devices` POST route. Creation does
not enable physical commissioning, MQTT transport, OTA or control writes.

Backend unit/HTTP tests use fixtures. The new path is **not deployed or
accepted with a real customer account**. In particular, verify that the
customer portal token is accepted by OpenRemote for realm-specific asset
creation and owner links, that an OpenRemote outage and a SQL failure reconcile,
and that the customer sees only its own tree on mobile/desktop. The first
customer invitation is still `sent` with no active membership; no live Site
may be created for it until that invitation completes. The existing pilot
and existing equipment update paths remain separate technical debt.

## Клиентски Обект и потвърден шлюз — локална реализация, 27.09.2026

Собственикът одобри създаване на клиентски Обект и устройство през
съществуващите екрани на GrideX. Локалният API подготвя
`POST /api/v1/sites` и `POST /api/v1/sites/:siteId/gateways` само за
проверен администратор на организацията. Вторият маршрут приема ROCK Pi E
или двата потвърдени OLIMEX ESP32-EVB варианта; ESP32 изисква родител ROCK Pi
в същия Обект. И двете заявки изискват стабилен `Idempotency-Key`.
Устойчивата SQL заявка е състояние на процеса, не активен инвентар.
Преди локалната проекция се проверяват точният realm, OpenRemote asset и
връзката към потребителя. Повторение намира съществуващия asset чрез
`gridexResourceId`, без сляпо изтриване или дублиране. Нов клиент не може
да използва старите local-first POST маршрути `/hardware-configurations` и
`/devices`. Създаването не активира физическо пускане, MQTT, OTA или команди.

Тестовете на backend са с имитации. Новият път **не е внедрен или приет с
реален клиентски акаунт**. Остават проверка на клиентския portal token в
OpenRemote за неговия realm, отказ/съгласуване при OpenRemote и SQL грешка,
както и видимост само на собственото дърво на mobile/desktop. Първата
клиентска покана още е `sent` без членство; няма право на нов жив Обект преди
приемането ѝ. Старите пилотни и equipment update маршрути са отделен дълг.

## Decision and scope — 2026-09-20

Subsequent owner-approved execution: the pilot Site/ROCK/ESP now exist in OR,
with verified owner links and local projection bindings; the existing temperature
asset was reparented without changing its identity. See newest HANDOFF for
backups, role changes and tests. Historical findings below describe the review
baseline; generic provisioning enforcement and browser acceptance remain pending.

Owner requirement: no operational Site/device/resource may be provisioned
independently of OpenRemote. This review changes documentation only. No live
resources, bindings, permissions, network settings or control locks were changed.

OpenRemote owns operational asset identity, hierarchy and attributes; its
existing TimescaleDB stores historical measurements. Keycloak owns login and
credentials. GrideX owns the user-facing workflow and business records, including
invitations, billing, scoped authorization, drafts, audit and delivery outboxes.
Local resource rows are bindings/projections, not a competing source of truth.
Provisioning through the GrideX website remains the intended user experience;
users do not need to provision manually in the OpenRemote administration UI.

## Findings

- `scripts/register-local-test-site.mjs` inserts a Site and gateways directly
  into GrideX SQL, without creating a corresponding OpenRemote resource tree.
- `repository.mjs:saveHardwareConfiguration` stores drafts and gateway/port rows
  locally. Drafts are valid, but these rows must not constitute independently
  provisioned devices. Gateways lack the mandatory OpenRemote binding contract.
- `app.mjs` equipment creation DOES call OpenRemote before successful binding.
  However, `asset-blueprints.mjs` permits an absent Site parent. A successful OR
  create followed by a failed local binding lacks a complete recovery workflow.
- Equipment updates save SQL first and skip OR when no asset ID exists. OR
  failure after the SQL update can leave inconsistent state.
- The preceding read-only account audit found the pilot Site without an OR Site
  binding; the owner-linked CPU temperature ThingAsset had no parent. This is a
  partial measurement integration, not complete Site/ROCK/ESP provisioning.
- Heartbeat ingestion checks GrideX gateway/Site ownership, not a complete OR
  asset tree. Receiving live packets does not resolve the inventory gap.

## Required workflow and acceptance

GrideX UI -> authorized API -> durable pending intent -> supported OpenRemote
API -> verified asset/parent/realm/owner access -> durable binding -> success.

Pending intent is allowed before the OR request. Cross-system operations are
not a single SQL transaction: require stable identifiers, idempotency, read-back
and reconciliation after timeouts or partial failures. Never silently fall back
to local-only success, and never blindly delete an existing asset on retry.
Logical provisioning and physical activation/acknowledgement remain separate.
Do not equate an organization with a realm without an explicit tenancy design.

Implementation backlog (all pending):

1. Audit and map existing Sites/devices/owners/OR IDs; back up both systems.
2. Define the OR Site -> ROCK/ESP/equipment hierarchy and ownership mappings.
   Temperature is normally an attribute of its device; use separate sensor
   assets only when they have an independent resource identity.
3. Implement one provisioning/update/reconciliation service; route UI, import
   and bootstrap operations through it. Add explicit lifecycle/binding checks.
4. Reconcile existing pilot resources without losing local IDs, ownership,
   certificate/topic bindings or historical data. Decide whether to reparent
   the current temperature asset or migrate its attribute/history safely.
5. Read consistent resource projections in the UI; expose pending/failed state
   accurately. Do not stop current telemetry merely to hide migration debt.
6. Test OR unavailable, retries without duplicates, OR success/SQL failure,
   cross-owner access denial, updates with missing bindings, and matching
   owner-visible Site/device trees in GrideX and OpenRemote.
7. Verify genuine ROCK heartbeat, ESP contact and temperature history separately;
   resource creation alone does not establish physical connectivity.

## Решение и обхват — 2026-09-20

Последващо одобрено изпълнение: пилотните Обект/ROCK/ESP вече са в OR с проверени
owner links и локални проекции/bindings; температурният asset е преместен без
промяна на идентичността. Виж най-новия HANDOFF за backups, роли и тестове.
Констатациите по-долу са изходното състояние при прегледа; универсалните
provisioning защити и browser приемането още предстоят.

Изискване на собственика: operational Обект/устройство/ресурс не се провизира
независимо от OpenRemote. Този преглед променя само документация. Няма промени
по живи ресурси, bindings, права, мрежа или control locks.

OpenRemote управлява ресурсната идентичност, йерархията и атрибутите; наличната
му TimescaleDB пази историческите измервания. Keycloak управлява входа и
идентификационните данни. GrideX управлява потребителския процес и бизнес
записите: покани, плащания, ограничени права, чернови, audit и delivery outbox.
Локалните ресурсни редове са bindings/проекции, не конкурентен основен регистър.
Потребителят продължава да провизира през GrideX, без ръчно създаване в OR UI.

## Констатации

- `scripts/register-local-test-site.mjs` записва Обект и шлюзове директно в
  GrideX SQL, без съответно OpenRemote ресурсно дърво.
- `repository.mjs:saveHardwareConfiguration` пази чернови и gateway/port редове
  локално. Черновите са допустими, но не са независимо провизирани устройства.
  За шлюзовете липсва задължителният договор за OpenRemote binding.
- Създаването на оборудване в `app.mjs` ДЕЙСТВИТЕЛНО извиква OpenRemote преди
  успешен binding. Но `asset-blueprints.mjs` допуска липсващ родителски Обект.
  Липсва пълно възстановяване след успешен OR create и неуспешен локален binding.
- Обновяването първо записва SQL и пропуска OR при липсващ asset ID. OR отказ
  след SQL запис може да остави несъгласувани данни.
- Предходната read-only проверка на акаунта установи пилотен Обект без OR Site
  binding и свързан към собственика CPU temperature ThingAsset без родител.
  Това е частична интеграция на измерване, не пълно provisioning на Обект/ROCK/ESP.
- Heartbeat проверява GrideX gateway/Обект принадлежност, не пълно OR дърво.
  Живите пакети не отстраняват пропуска в ресурсния регистър.

## Задължителен процес и приемане

GrideX UI -> API с проверени права -> устойчива чакаща заявка -> поддържан OR
API -> проверени asset/родител/realm/права -> устойчив binding -> успех.

Чакаща заявка преди OR е допустима. Няма обща SQL транзакция между системите:
нужни са устойчиви идентификатори, идемпотентност, read-back и съгласуване след
timeout/частичен отказ. Без local-only успех или сляпо изтриване при повторение.
Логическо provisioning и физическо активиране/потвърждение остават отделни.
Организация не се приравнява на realm без изричен tenancy дизайн.

Задачи за реализация (всички незавършени):

1. Инвентаризация и съпоставяне на Обекти/устройства/собственици/OR IDs; backup.
2. Определяне на OR Обект -> ROCK/ESP/оборудване и правата. Температурата обичайно
   е атрибут на устройството; отделен sensor asset само при отделна идентичност.
3. Един provisioning/update/reconciliation service за UI, import и bootstrap;
   явни lifecycle/binding проверки.
4. Съгласуване на пилотните ресурси без загуба на локални IDs, собственост,
   certificate/topic bindings и история. Избор между reparent на температурния
   asset и безопасно преместване на атрибут/история.
5. Съгласувани UI проекции с точни pending/failed статуси. Без спиране на
   телеметрията само за прикриване на миграционния дълг.
6. Тестове: OR отказ, повторения без дублиране, OR успех/SQL отказ, забрана за
   чужд собственик, update без binding и еднакви GrideX/OR дървета за собственика.
7. Отделна проверка на реален ROCK heartbeat, ESP контакт и температурна история;
   създаден ресурс не доказва физическа връзка.
