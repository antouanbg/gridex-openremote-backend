# Mailgun enrollment / Регистрация през Mailgun

## English

Keycloak generates/verifies action links and renders templates; the custom
EmailSenderProvider sends them through Mailgun REST, not SMTP. It is compiled
against pinned Keycloak 26.7.3 libraries; rebuild/test it on upgrades. The Node
transport uses the same settings for operator probes/future application mail.
There is no public arbitrary-send API.

All settings are in the single private `~/GrideX-runtime/backend/.env`, mode
0600, outside Git. `.env.example` documents the keys. No Keychain or service
env alternatives. The one-time `scripts/consolidate-backend-env.mjs` migrates
historical split settings, rejects conflicts and keeps a private rollback.

- `GRIDEX_MAILGUN_REGION`: EU/US; fixed HTTPS endpoint.
- `GRIDEX_MAILGUN_DOMAIN`, `GRIDEX_MAILGUN_FROM`, `GRIDEX_MAILGUN_API_KEY`:
  verified sending domain, sender, restricted sending key.
- `GRIDEX_MAILGUN_BCC`: comma-separated blind-copy recipients; empty disables.
  Applies to both transports, including invitations, verification and password
  reset. Copies contain usable account links: protect this mailbox as privileged
  access. BCC is not a substitute for audit/delivery status.
- `GRIDEX_SUPPORT_INBOX`: destination for the constrained contact-enquiry
  endpoint. Configure in the same private backend `.env`; do not expose a
  browser-selectable recipient. If it equals a BCC address, the Node sender
  omits the duplicate blind copy.
- `GRIDEX_SUPPORT_CC`: visible copy recipient for contact enquiries only.
  It is fixed in the same private `.env`, never selected by the browser.
  Invitations, verification, password reset and heartbeat alerts do not get
  this CC. A matching BCC is omitted to avoid duplicate delivery.
- `GRIDEX_ENROLLMENT_ENABLED`, `GRIDEX_ENROLLMENT_CLIENT_SECRET`: dedicated
  enrollment identity, separate from the OpenRemote Asset client.
- `GRIDEX_PUBLIC_AUTH_BASE`, `GRIDEX_ADMIN_AUTH_BASE`, `GRIDEX_PORTAL_ORIGIN`:
  public issuer, private administration and exact portal origin.

### Deployment and initial owner

Back up identity and GrideX databases first. From repository root:

```sh
docker-compose --context colima-gridex \
  --env-file "$HOME/GrideX-runtime/backend/.env" -p gridex-mac \
  -f compose.mac.yml -f compose.mailgun.yml \
  up -d --build --no-deps keycloak gridex-api
node scripts/run-email-bootstrap.mjs "$HOME/GrideX-runtime/backend/.env" \
  owner@example.com "Example organization"
```

Use explicitly approved owner/organization values. Bootstrap uses the private
master credential once, creates `gridex-enrollment` with realm manage/view/query
users roles, an unverified user with VERIFY_EMAIL/UPDATE_PASSWORD, and an
organization administrator membership with organization-wide site scope. It
does not assign Keycloak/master admin to the person, set a password, verify
email on their behalf, or create physical Sites. Conflicting identities or
organizations fail closed. Public signup is disabled; password reset is enabled.

The owner opens the email, verifies ownership, sets a password and returns to
the portal. Subsequent invitations use explicit Sites and viewer/operator/
energy_manager/integrator roles; administrator assignment is not exposed in
the invitation form. Verified matching identity and invitation acceptance are
required before membership is granted.

Only Keycloak and `gridex-api` get the Mailgun key; email egress remains
restricted and no new public port is opened. Existing `restart: unless-stopped`
applies; Colima must also start
after reboot. Always include the email override when recreating the deployment.
Retired split env files must not be loaded again.

### Delivery and acceptance

Tracking is disabled, redirects rejected, timeouts bounded, and neither transport
logs keys, content or action links. Mailgun acceptance is not inbox delivery.
No automatic retry after uncertain outcomes. Bootstrap records started/queued
audit checkpoints and does not resend a recorded successful attempt. An uncertain
attempt requires provider inspection and an explicit decision; do not delete audit.
Bounce/delivery webhooks and a durable application-mail outbox remain future work.
This is not an exactly-once or guaranteed-delivery system.

The contact-enquiry endpoint accepts only a fixed support recipient. Anonymous
demo visitors and verified signed-in members may submit a name, topic and
message. Signed-in email comes from the verified token. Every request needs a
short-lived one-use human question; a honeypot and per-address/global rate
limits reduce automated submissions. These controls are friction, not a
guarantee against a determined bot. An HTTP 202 means Mailgun queued the
message, not that it reached the support mailbox. No automatic retry follows
an uncertain provider result. A public browser acceptance test with a real
recipient remains necessary after API and portal deployment.

```sh
node --env-file="$HOME/GrideX-runtime/backend/.env" \
  scripts/test-mailgun.mjs owner@example.com
```

Default is provider test mode; `--send` is an authorized real send including BCC.
API tests cover BCC/injection/fail-closed invitations. Provider build tests check
BCC, tracking and action-link encoding. Remaining live acceptance: recipient
verification/password setup, browser PKCE login, own/foreign Site rights,
logout and password reset. Database restore drills remain a separate task;
Timescale restore constraints require attention.

Reference: [Keycloak EmailSenderProvider](https://www.keycloak.org/docs-api/latest/javadocs/org/keycloak/email/EmailSenderProvider.html).

## Български

Keycloak генерира/проверява action връзките и шаблоните; custom EmailSenderProvider
ги изпраща през Mailgun REST, не SMTP. Компилира се срещу фиксиран Keycloak 26.7.3;
при upgrade се build-ва/тества отново. Node транспортът ползва същите настройки
за операторски проби/бъдещи application писма. Няма публичен произволен send API.

Единственият конфигурационен файл е частният `~/GrideX-runtime/backend/.env`,
0600, извън Git. Имената са в `.env.example`; няма Keychain/service env алтернативи.
`scripts/consolidate-backend-env.mjs` еднократно обединява историческите настройки,
отказва конфликти и пази частен rollback.

- `GRIDEX_MAILGUN_REGION`: EU/US, фиксиран HTTPS endpoint.
- `GRIDEX_MAILGUN_DOMAIN`, `GRIDEX_MAILGUN_FROM`, `GRIDEX_MAILGUN_API_KEY`:
  потвърден sending домейн, подател, ограничен sending ключ.
- `GRIDEX_MAILGUN_BCC`: скрити получатели със запетая; празно изключва копието.
  Важи за двата транспорта, включително покани, потвърждение и възстановяване на
  парола. Копията съдържат работещи account връзки: пази пощата като привилегирован
  достъп. BCC не замества audit/следене на доставка.
- `GRIDEX_SUPPORT_INBOX`: получателят на ограничените запитвания. Задава се в
  същия частен backend `.env`; браузърът не избира получателя. Ако адресът
  присъства и в BCC, Node не добавя второ копие.
- `GRIDEX_SUPPORT_CC`: видимо копие само за запитванията, зададено в същия
  частен `.env`, не от браузъра. Поканите, потвържденията, възстановяването
  на парола и heartbeat известията не получават това CC. Съвпадащ BCC не се
  изпраща повторно.
- `GRIDEX_ENROLLMENT_ENABLED`, `GRIDEX_ENROLLMENT_CLIENT_SECRET`: отделна
  enrollment идентичност, различна от OpenRemote Asset клиента.
- `GRIDEX_PUBLIC_AUTH_BASE`, `GRIDEX_ADMIN_AUTH_BASE`, `GRIDEX_PORTAL_ORIGIN`:
  публичен issuer, частна администрация и точен portal origin.

Преди горните deployment/bootstrap команди пази backup на двете бази. Ползвай
изрично одобрени собственик/организация. Bootstrap еднократно използва master
credential, създава `gridex-enrollment` с realm manage/view/query-users, непотвърден
профил с VERIFY_EMAIL/UPDATE_PASSWORD и организационен administrator с всички
нейни Обекти. Не дава Keycloak/master admin на човека, не задава парола, не
потвърждава имейла вместо него и не създава физически Обекти. Конфликти се отказват.
Публичната регистрация е изключена; възстановяването на парола е включено.

Собственикът отваря писмото, потвърждава имейла, задава парола и се връща в портала.
Следващите покани са с изрични Обекти и роли viewer/operator/energy_manager/
integrator; формата не дава administrator. Преди членството са нужни потвърден
съвпадащ имейл и приемане на поканата.

Само Keycloak и `gridex-api` получават Mailgun ключа; изходът за поща остава
ограничен и няма нов публичен порт. `restart: unless-stopped` остава;
Colima също трябва да стартира след reboot.
Винаги включвай email override при пресъздаване. Старите env файлове не се зареждат.

Tracking е изключен, redirects се отказват, timeout е ограничен; не се логват
ключове, текстове или action връзки. Приемането от Mailgun не доказва доставка.
Няма автоматичен retry при неясен резултат. Bootstrap пази started/queued audit
и не повтаря записан успешен опит. При неясен опит: provider проверка и изрично
решение, без изтриване на audit. Delivery/bounce webhooks и трайна application-mail
опашка остават бъдеща работа; няма exactly-once/гарантирана доставка.

Публичното API за запитвания изпраща само до фиксирания support получател.
Посетител на демото или потвърден влязъл потребител може да подаде име, тема
и съобщение; при вход имейлът се взема от проверения токен. За всяко
запитване се иска кратка еднократна проверка за човек. Скрито поле и
ограничения по адрес/общ брой намаляват автоматичните заявки, но не са
гаранция срещу настойчив бот. HTTP 202 означава, че Mailgun е приел писмото
за изпращане, не че е доставено. При неясен отговор няма автоматичен retry.
След внедряване са нужни реален браузърен тест и проверка в support пощата.

Тестовият CLI по подразбиране е test mode; `--send` е одобрено истинско писмо с BCC.
API тестовете покриват BCC/injection/fail-closed покани; provider build проверява
BCC, tracking и action-link encoding. Остават личното потвърждение/парола, browser
PKCE вход, права за собствен/чужд Обект, изход и reset password. Restore тренировката
е отделна задача; Timescale ограниченията изискват внимание.
