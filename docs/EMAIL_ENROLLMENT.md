# Email enrollment / Регистрация по имейл

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## English

Status: backend foundation, not completed end-to-end registration. Enrollment is
disabled by default. No real invitation email or browser onboarding was tested.

Keycloak owns passwords, email verification and expiring action links. GrideX
stores invitation metadata and grants no membership until explicit acceptance
by the invited subject with a verified, matching email in the validated token.
An email proves mailbox access, not legal identity. No password or action token
is stored in the GrideX database, browser code or Git.

The dedicated `gridex-enrollment` confidential client uses client credentials
against the configured realm. It must be provisioned separately with only the
user-management rights needed by the adapter; do not reuse the Asset client or
master admin credentials. SMTP is configured privately in Keycloak, not in Git.
Reference: [Keycloak email actions](https://www.keycloak.org/docs-api/24.0.5/javadocs/org/keycloak/admin/client/resource/UserResource.html).

API (authenticated, normal CORS policy):

- `POST /api/v1/organisations/{id}/invitations`: `{email, role, siteIds}`;
  current database organisation administrator only. Roles: viewer, operator,
  energy_manager, integrator. No administrator promotion through invitations.
- `GET /api/v1/me/invitations`: own, verified email, unexpired sent invitations.
- `POST /api/v1/invitations/{id}/accept`: atomic single acceptance, no body.
- `POST /api/v1/organisations/{id}/invitations/{id}/revoke`: administrator only.

New users receive VERIFY_EMAIL and UPDATE_PASSWORD actions; existing identities
are not overwritten or forcibly password-reset. Email dispatch is not proof of
delivery. Failed dispatch grants nothing. Invitations expire after 24 hours.
Existing membership is never overwritten by acceptance. Expired/revoked links,
different identities/emails and concurrent replays cannot create membership.
Acceptance rechecks inviter authority and site ownership. Revoking an invitation
does not revoke an already accepted membership; membership management UI/API is
still required. No automatic resend is implemented.

Access is evaluated using PostgreSQL on every request. Site routes use the role
of that site's organisation, not the union of token roles. Migration 003 preserves
existing organisation-wide grants explicitly; new memberships default to no
sites and require selected grants. In-flight requests already authorized are not
cancelled by a later revocation. Migration 004 stores invitations and audit events.

Activation configuration (not enabled until acceptance):

- `GRIDEX_ENROLLMENT_ENABLED=true`
- `GRIDEX_ENROLLMENT_CLIENT_SECRET`: local secret only
- `GRIDEX_ENROLLMENT_ADMIN_URL`: internal Keycloak `/auth/admin/realms/gridex`
- `GRIDEX_ENROLLMENT_REDIRECT_URI`: exact allowed portal callback

Remaining: provision dedicated service client; configure/test SMTP; enforce
email-as-username, recovery and administrator MFA in Keycloak; frontend invitation
form and acceptance flow in `antouanbg/gridex-energy-os`; membership changes and
revocation endpoint; abuse/rate limits, resend reconciliation and browser
login/logout acceptance. Keep registration disabled until this checklist passes.

Tests: 16 unit/API tests; disposable PostgreSQL tests exercise concurrent
acceptance, expiry, revocation, email mismatch, unverified identity, explicit
grants and delivery failure. Identity/email delivery is fake in that DB test;
it does not prove Keycloak integration or SMTP.

## Български

Статус: backend основа, не завършена регистрация от край до край. Регистрацията
е изключена по подразбиране. Няма тест с реален имейл или browser onboarding.

Keycloak управлява пароли, потвърждаване на имейл и линкове със срок. GrideX
пази метаданните на поканата и дава членство само след изрично приемане от
поканения subject с потвърден съвпадащ имейл във валидирания token. Това доказва
достъп до пощата, не юридическа самоличност. Пароли и action tokens не се пазят
в GrideX базата, browser кода или Git.

Отделният confidential клиент `gridex-enrollment` използва client credentials
за съответния realm. Трябва да се създаде с минималните права за потребители,
нужни на адаптера; не се използват Asset клиентът или master admin паролата.
SMTP се конфигурира частно в Keycloak, не в Git. Референцията е посочена по-горе.

API изисква автентикация и стандартната CORS проверка:

- `POST /api/v1/organisations/{id}/invitations`: `{email, role, siteIds}`;
  само текущ администратор на организацията според базата. Роли: viewer,
  operator, energy_manager, integrator. Без повишаване до администратор с покана.
- `GET /api/v1/me/invitations`: собствени изпратени неизтекли покани с потвърден имейл.
- `POST /api/v1/invitations/{id}/accept`: атомарно еднократно приемане без body.
- `POST /api/v1/organisations/{id}/invitations/{id}/revoke`: само администратор.

Новите потребители получават VERIFY_EMAIL и UPDATE_PASSWORD. Съществуващите
идентичности не се презаписват и паролите им не се reset-ват принудително.
Изпращане не доказва доставка; неуспехът не дава членство. Срокът е 24 часа.
Приемането не презаписва съществуващо членство. Изтекли/отменени покани, чужд
subject/имейл и паралелно повторно приемане не създават членство. Проверяват се
повторно правата на канещия и принадлежността на обектите. Отмяната на покана
не отнема вече прието членство; предстои membership UI/API. Няма автоматичен resend.

Правата се четат от PostgreSQL при всяка заявка. За обект се използва ролята
в неговата организация, не обединение на token роли. Миграция 003 запазва
изрично старите организационни права; новите членства нямат обекти без grants.
Вече разрешена текуща заявка не се отменя от последващо отнемане на достъп.
Миграция 004 добавя поканите; действията се записват в audit.

Настройки за активиране след приемателните тестове: `GRIDEX_ENROLLMENT_ENABLED`,
`GRIDEX_ENROLLMENT_CLIENT_SECRET` (само локално), `GRIDEX_ENROLLMENT_ADMIN_URL`
(вътрешен `/auth/admin/realms/gridex`), `GRIDEX_ENROLLMENT_REDIRECT_URI`
(точен разрешен callback). Стойностите са описани в EN секцията.

Остава: отделен service клиент; SMTP; email-as-username, възстановяване на парола
и MFA за администратори в Keycloak; форми за покана/приемане във frontend
`antouanbg/gridex-energy-os`; промяна/отнемане на членство; rate limits, resend
reconciliation и browser тестове за вход/изход. Регистрацията остава изключена.

Тестове: 16 unit/API теста и отделна временна PostgreSQL база за паралелно
приемане, срок, отмяна, чужд/непотвърден имейл, избрани обекти и неуспешно
изпращане. Identity/email адаптерът в DB теста е симулиран; не доказва SMTP
или интеграция с Keycloak.
