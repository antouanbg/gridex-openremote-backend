# Service administration / Администрация на услуги

## English

Layout clarification 2026-10-02: one continuous GrideX administration page,
not tabs. Catalogue precedes invitations/history and the member editor; the
platform administrator first selects an approved organisation. All roles share
one visual design. New organisation invitations require firstName and lastName
(trimmed, 1–80 characters, no control characters), stored and verified in
Keycloak alongside email. Existing identities are never overwritten.

Owner-approved contract: the existing `/customers/users/` page lists all five
services, regardless of grants. Only `day_ahead` (BG/BG) and `visualisations`
are requestable. Future entries remain visible but disabled. An organisation
administrator requests for their own active organisation; only a verified
allowlisted platform administrator decides that scope. Members request only
for themselves; their organisation administrator decides after an organisation
grant. Approval is immediate, not a recipient acceptance step. Revoking an
organisation grant removes member grants; later re-enabling never restores them.

| API | Contract |
| --- | --- |
| GET organisation services | All five entries, enabled flag, grant timestamp and zone scope; exact active administrator/realm |
| POST organisation service-requests | Organisation administrator only; scope organisation; one open request per service/organisation |
| POST organisation service-requests/id/cancel | Only submitting administrator, open organisation request, no effective grant |
| POST platform service-requests/id/approve or reject | Organisation scope only; active organisation and current administrator; no member grant |
| POST organisation service-requests/id/approve or reject | Member scope only, matching organisation; approval requires organisation/zone grant |
| PUT organisation services/code/members/subject | Explicit approved member; independent of role/Sites; requires organisation/zone grant |
| GET organisation members | Realm-scoped roster and verified OpenRemote links, limit/offset/search and total |

Migration 022 adds `request_scope`, cancellation and `service_notifications`.
Business grants/requests remain in GrideX SQL; operational inventory and user–
Asset links remain authoritative in OpenRemote. Transactional notifications
deduplicate by event/recipient. Resolve enabled verified recipient email from
Keycloak immediately before sending, using the existing private setup service.
Requests notify the responsible administration level; grants/revocations notify
affected recipients. Mailgun accepted is queued, not delivered. Unknown send
outcomes never automatically retry; interrupted sending becomes unknown.
The existing API processes the outbox every 30 seconds; no new public endpoint,
container, secret source or human permission is introduced.

Deploy: `scripts/deploy-service-admin.mjs --apply` checks effective Compose
environment, saves a private DB dump and rollback image, builds the API,
applies transactional migration 022 and recreates only API. Failure restores
the previous image. The additive schema is compatible with the old reader;
never delete production workflow data to undo a deployment.
`scripts/check-service-admin-live.mjs` runs inside API and uses read-only real
membership/OpenRemote checks; it does not prove browser authentication or mail
delivery. Record live acceptance separately in HANDOFF.

## Български

Уточнение за лейаута 2026-10-02: общ непрекъснат екран, без табове.
Каталогът е преди поканите/историята и редактора; супер администраторът
първо избира одобрена организация. Всички роли имат един дизайн. Новите
организационни покани изискват firstName и lastName (подрязани интервали,
1–80 символа, без контролни символи), записани и проверени в Keycloak с
имейла. Съществуващите самоличности не се презаписват.

Одобрен договор: съществуващата `/customers/users/` показва петте услуги
независимо от права. Заявяеми са само `day_ahead` (BG/BG) и `visualisations`;
бъдещите остават видими и неактивни. Администраторът заявява само за своята
активна организация; провереният супер администратор решава този обхват.
Членът заявява само за себе си; неговият администратор решава след
организационно разрешение. Правото действа веднага, без приемане от получателя.
Отнемането на организационното право премахва личните; повторното включване
не ги възстановява автоматично.

| API | Договор |
| --- | --- |
| GET organisation services | Петте услуги, флаг, час на разрешение и зона; точен активен администратор/realm |
| POST organisation service-requests | Само организационен администратор; една отворена заявка за услуга/организация |
| POST organisation service-requests/id/cancel | Само подалият администратор; отворена организационна заявка без действащо право |
| POST platform service-requests/id/approve или reject | Само организационен обхват, активна организация и текущ администратор; без лично право |
| POST organisation service-requests/id/approve или reject | Само членски обхват и същата организация; разрешение изисква организационно право/зона |
| PUT organisation services/code/members/subject | Изричен одобрен член; отделно от роля/Обекти; изисква право/зона на организацията |
| GET organisation members | Списък в realm, проверени OpenRemote връзки, limit/offset/search и общ брой |

Миграция 022 добавя обхват, отмяна и `service_notifications`. Бизнес права/
заявки са в GrideX SQL; инвентарът и user–Asset връзките остават в OpenRemote.
Транзакционните уведомления премахват повторения по събитие/получател.
Непосредствено преди изпращане имейлът се сверява с активния потвърден
Keycloak профил през наличния частен setup service. Заявките уведомяват
решаващото ниво; права/отнемане — засегнатите получатели. Прието от Mailgun
е в опашката, не доставено. Неясен резултат не се повтаря автоматично;
прекъснато изпращане става unknown. Наличният API обработва опашката през
30 секунди, без нов публичен endpoint, контейнер, източник на тайни или
човешки права.

Внедряване: `scripts/deploy-service-admin.mjs --apply` сверява Compose
настройките, пази частен DB архив и image за връщане, изгражда API, прилага
транзакционна миграция 022 и пресъздава само API. При отказ връща предишния
image. Допълнената схема е съвместима със старото четене; без изтриване на
живи заявки за връщане. `scripts/check-service-admin-live.mjs` проверява
реални членства/OpenRemote само за четене вътре в API, но не доказва browser
вход или доставен имейл. Реалното приемане се записва отделно в HANDOFF.
