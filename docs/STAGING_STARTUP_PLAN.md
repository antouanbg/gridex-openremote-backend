# Isolated staging startup plan / План за изолирано staging стартиране

Repository / GitHub: antouanbg/gridex-openremote-backend

## English

### Scope and decision — 2026-09-14

Plan against main `279745b9c00f8a7eaafc3494b9ae510bf0635006`: exactly six services,
`gridex-api`, `gridex-db`, `proxy`, `postgresql`, `keycloak`, `manager`.
Open PRs are not assumed merged. Windows 10 is a temporary test environment;
Windows 11 remains the planned production architecture on suitable hardware.
This planning PR includes the previous diagnosis. It installs nothing, creates
no networks, launches no containers, and sends no commands to physical devices.

**Startup is blocked.** Manager 1.30.0 uses UBI 10 OpenJDK 21, whose x86-64-v3
baseline is incompatible with Xeon X5660. Host runtime checks report AVX=false
and AVX2=false. Hyper-V does not add missing CPU instructions; no BIOS change.
A linux/amd64 manifest does not prove CPU compatibility. Resolve this with a
separately reviewed Manager 1.30.0 build on a maintained CPU-compatible Java 21
base, including dependency/startup tests, or a suitable test host. Do not silently
downgrade. Manager 1.23.0 used UBI 9, but is only a historical fallback candidate,
not security-reviewed or tested with this API/current Keycloak. Inspected Manager
versions 1.24.0 through 1.30.0 use UBI 10.

### Docker and license gate

Current release notes list Docker Desktop **4.90.0, 2026-09-07**. Windows docs
list Enterprise 22H2/build 19045 and Hyper-V in the **all-users installation**;
per-user installation does not provide Hyper-V. Docker also limits support to
Windows versions within Microsoft's servicing timeline. Standard Windows 10
22H2 support ended 2025-10-14. ESU entitlement, patch currency and Docker support
for this serviced installation remain unverified: technical requirements match
conditionally, vendor-supported status is not confirmed. Do not bypass an
installer rejection or select an obsolete Docker build to evade it.

Hyper-V is active; the `Containers` optional feature is disabled. Docker lists
both as Hyper-V prerequisites. After separate installation authorization, verify
and enable only required Windows features and arrange any reboot. Select
all-users/Hyper-V/Linux containers; no WSL or BIOS change. Installation may create
a virtual switch/NAT, so it is outside the existing no-network-changes scope.
Proposed initial VM budget: 8 GiB RAM / 4 vCPUs; measure before increasing and
reserve SSD space for images, volumes and a restore copy.

Desktop is free for personal use, education, non-commercial open source and
businesses with fewer than 250 employees AND under USD 10 million annual revenue.
Other professional use beyond those limits and government use require a paid
subscription. MIT licensing alone does not establish eligibility. Record the
applicable category/subscription locally before installation; do not automatically
accept license terms in a script.

### Fixed image candidates

Registry metadata was checked without pulling images; all references in the
shared table below have linux/amd64 manifests. This is a candidate set, **not a
tested or X5660-compatible stack**. Manager 1.30.0 requires Keycloak >=26.7.0;
26.7.3.0 satisfies that version constraint. No all-component compatibility
certificate was found. CPU and runtime gates remain mandatory. API is built from
the main commit and package-lock.json; its `node:22-alpine` base still needs a
compatible exact digest, and the resulting local image ID must be recorded.

### Staging override to implement

Create `compose.staging.yml` and a launcher that always supplies both Compose
files, an explicit local env file and project name `gridex-staging`. Never run
base Compose alone: it publishes HTTP/HTTPS on all interfaces and requires a
VPN bind for MQTT. The runnable override is deferred until the CPU image and
OIDC blockers are resolved; this document is not an executable startup recipe.

- Replace proxy ports with `!override`: only `127.0.0.1:80:80` and
  `127.0.0.1:443:443`. API HTTP: `127.0.0.1:8081:8080` for local API test clients.
  No MQTT 1883/8883, database, metrics or IPv6 wildcard publications.
- Require Compose >=2.24.4. Interpolation precedes merge: supply the non-secret
  local sentinel `VPN_BIND_ADDRESS=127.0.0.1` for base parsing, then verify the
  merged model has NO MQTT publication. The sentinel never permits base-only use.
- All six services use one project-scoped `internal: true` bridge. No external
  networks, host networking, extra_hosts/host gateways, privileged mode, devices,
  Docker socket, VPN mounts or physical endpoint configuration. Verify effective
  egress isolation on Docker Desktop without probing any real device.
- Use fresh project-scoped volumes for both databases, manager-data and proxy-data.
  Replace deployment mounts with an ignored staging directory containing only
  inspected branding/empty setup. No production volumes, inventories or Agents.
- Pull/build before runtime isolation. Disable demo/auto-provisioning, setup replay
  on restart, external mail/webhooks and physical Agents/rules. Confirm empty
  Agents/rules before fixtures. Hard-code `GRIDEX_WRITES_ENABLED=false`,
  `GRIDEX_AUTO_MIGRATE=false`; disable the memory database. API locks alone do not
  isolate OpenRemote's own control paths.
- Add API healthcheck using Node fetch of `/health`; inspect every pinned image's
  inherited check and add a proxy check if absent. `/health` only checks Manager
  HTTP availability, not database/schema/auth readiness.
- Reset legacy Keycloak environment entries; 26.7 needs
  `KC_BOOTSTRAP_ADMIN_PASSWORD` and `KC_HOSTNAME=https://localhost/auth`.
  Use localhost/443 consistently; inspect redirects and keep TLS/issuer validation.

### Local secrets and OIDC bootstrap

Use an operator-only directory outside Git or explicitly ignored staging storage;
verify ignore rules and Windows ACLs before secret writes. Current `.gitignore`
ignores `.env`, not arbitrary `.env.staging`. Never publish resolved Compose env,
tokens, credential-bearing inspect output or dumps in logs/PRs. Required local
secrets: `OR_ADMIN_PASSWORD`, `GRIDEX_DATABASE_PASSWORD`,
`OPENREMOTE_SERVICE_CLIENT_SECRET`, and a separate OpenRemote DB password mapped
to `POSTGRES_PASSWORD`, `KC_DB_PASSWORD`, `OR_DB_PASSWORD`. Verify variables in
selected images and replace upstream sample credentials. TLS keys, Manager
Keycloak grant files, exports and backups also stay local. Do not assume `_FILE`
support; injected environment remains visible to Docker administrators.

After gates: start the two DBs, Keycloak, Manager, then proxy with empty staging
volumes/setup. Trust only the verified local certificate (or an approved local
certificate); no global TLS bypass. Provision a synthetic `gridex` realm through
OpenRemote's supported realm flow so required clients/roles exist. Verify both
Keycloak admin and Manager login. Discovery issuer must be
`https://localhost/auth/realms/gridex`.

Create public `gridex-portal` with Authorization Code + PKCE S256, exact loopback
redirect URI for the local harness, exact web origin, no wildcard/implicit/password
grant or client secret. Add audience mapper `gridex-portal` and roles from
`auth.mjs`. Create confidential `gridex-api` with service accounts and minimal
synthetic Asset read permissions, not realm-admin. Save its secret locally before
API startup. Seed two synthetic organisations/Sites and memberships with actual
Keycloak `sub` values: realm roles alone do not grant Site access. Test users:
viewer, operator, administrator and a user with no application role.

**Main API blocker:** `getServiceToken()` posts to `OIDC_ISSUER`; localhost there
is the API container itself. Code supports `OIDC_JWKS_URI`, but Compose does not
pass it. Plan a focused tested change adding an explicit internal token endpoint
while preserving external issuer validation. Proposed, not implemented:

```text
OIDC_ISSUER=https://localhost/auth/realms/gridex
OIDC_JWKS_URI=http://keycloak:8080/auth/realms/gridex/protocol/openid-connect/certs
OPENREMOTE_TOKEN_URL=http://keycloak:8080/auth/realms/gridex/protocol/openid-connect/token
OPENREMOTE_BASE_URL=http://manager:8080
```

Test internal token requests and rejection of wrong issuer/audience. Internal HTTP
stays within the isolated network. Do not change issuer to an unrelated hostname
or disable certificate validation as a workaround.

### Migrations and acceptance

`repository.migrate()` runs only `001_gridex_core.sql`; no ledger or automatic
`002_olimex_edge_hardware.sql`. Fresh 001 already has the constraints restated by
002. Keep auto-migrate off. Apply 001 then 002 explicitly to empty staging DB using
`psql ON_ERROR_STOP=1`, container stdin/copied files, no shell-interpolated SQL.
Each file owns its transaction; stop on error. Check tables, foreign keys and
gateway role/transport constraints; record file hashes/order locally. Rehearse
reapplication on a disposable restore copy. This is not a production migration
runner. OpenRemote/Keycloak manage their own schemas in their shared DB, separate
from gridex-db; inspect schema ownership and boot logs.

Then start API with the local client secret and use Compose `up --wait` with a
bounded timeout (e.g. 600 seconds). Diagnose failures without deleting volumes or
resetting credentials. Use identical project/env/files for every command.
**All runtime acceptance checks below are NOT RUN.**

| Check | Required evidence |
|---|---|
| Linux/CPU | Engine reports linux; pinned benign container succeeds with --network none; approved Manager java -version works on this CPU before stack start; record Docker/Compose/image IDs. |
| Compose | config --quiet passes; locally inspect merged model without logging secrets: exactly six services, three loopback bindings above, no MQTT, isolated volumes/internal network, writes false, no host/device escape. |
| Health | Six healthy services without restart loops; /health=200 and writesEnabled=false; independent DB/schema queries. |
| Login | Keycloak admin and Manager browser login/logout, correct discovery/redirects/TLS; service token works without printing it. |
| API rights | Missing/expired/bad-signature/wrong-issuer/wrong-audience tokens: 401; valid /api/v1/me: 200; role-less /api/v1/device-types: 403; viewer read: 200; inaccessible Site: 404; correct membership filtering. |
| Locks | Viewer control request: 403; permitted operator: 423 writes_locked, only synthetic Site/control fixtures and contract-valid payload. Verify validation order. Never enable writes or contact devices to pass. |
| Isolation | Inspect ports/networks and empty physical Agents/rules; prove blocked egress with an operator-owned inert test target, never a physical device. |
| Persistence | Save API user preferences and disconnected harmless OpenRemote Asset; record IDs/revisions/counts. Restart all, then down/up WITHOUT -v: data, users, roles survive, no setup replay. |
| Restore | Fresh isolated restore project passes login, rights, fixture/revision/count comparisons and write lock; source volumes remain intact. |

Preferences/drafts can persist with writes disabled: it is not a global DB
read-only switch. Use only synthetic fixtures; no ROCK Pi/ESP32 access is needed.

Backup rehearsal: stop API/Manager/Keycloak writers and proxy; keep DBs available.
Dump gridex-db and all non-template databases plus roles/globals in OpenRemote
PostgreSQL, including Keycloak, with matching pg_dump/pg_dumpall. Write inside
containers then docker cp to ACL-protected local storage; avoid Windows PowerShell
binary redirection. Archive manager-data/proxy-data with writers stopped and
ownership preserved. Include protected local secrets, certificates, deployment
config, image references and migration hashes. Verify dump/archive integrity.
Stop source stack to free loopback ports; restore roles/DBs and archives into
fresh volumes under `gridex-staging-restore` with identical images. Do not replay
setup or migrations blindly. Repeat acceptance checks. No `down -v` or deletion;
source volumes stay intact. This rehearsal is not a production backup policy.

### Implementation order

1. Resolve CPU-compatible image, Docker OS support/patching and license category.
2. Implement override/guard, local ignore rules, exact API base, Keycloak bootstrap
   mapping and internal token endpoint with focused tests in an implementation PR.
3. Validate merged Compose on compatible Docker; review EN/BG and secret hygiene.
4. Only after installation/start authorization execute acceptance and record
   sanitized results. Keep CODEX_STATE.md and HANDOFF.md current for every blocker.

## Български

### Обхват и решение — 2026-09-14

План спрямо main `279745b9c00f8a7eaafc3494b9ae510bf0635006`: точно шест услуги,
`gridex-api`, `gridex-db`, `proxy`, `postgresql`, `keycloak`, `manager`.
Отворените PR-и не се приемат за слети. Windows 10 е временна тестова среда;
Windows 11 остава планираната production архитектура върху подходящ хардуер.
Planning PR включва предходната диагностика. Няма инсталации, създаване на мрежи,
старт на контейнери или команди към физически устройства.

**Стартирането е блокирано.** Manager 1.30.0 използва UBI 10 OpenJDK 21 с
x86-64-v3, несъвместим с Xeon X5660. Host runtime отчита AVX=false и AVX2=false.
Hyper-V не добавя липсващи CPU инструкции; без BIOS промяна. linux/amd64 manifest
не доказва CPU съвместимост. Решение: отделно прегледан Manager 1.30.0 build върху
поддържана CPU-съвместима Java 21 база с dependency/startup тестове или подходящ
тестов host. Без мълчаливо downgrade. Manager 1.23.0 използва UBI 9, но е само
исторически резервен кандидат, без security review или тест с API/текущ Keycloak.
Проверените Manager 1.24.0 до 1.30.0 използват UBI 10.

### Условие за Docker и лиценз

Текущите release notes посочват Docker Desktop **4.90.0, 2026-09-07**. Windows
docs включват Enterprise 22H2/build 19045 и Hyper-V при **инсталация за всички
потребители**; per-user няма Hyper-V. Docker ограничава поддръжката до Windows
версии в Microsoft servicing. Стандартната Windows 10 22H2 поддръжка приключи на
2025-10-14. ESU правата, patches и Docker поддръжката за тази обслужвана инсталация
не са проверени: условно техническо съответствие, без потвърдена vendor поддръжка.
Без заобикаляне на installer отказ или избор на остарял Docker за избягването му.

Hyper-V е активен; `Containers` optional feature е изключен. Docker изисква и
двете за Hyper-V. След отделно разрешение за инсталация се проверяват/включват
само нужните Windows features и се планира евентуален рестарт. Избор:
all-users/Hyper-V/Linux containers; без WSL или BIOS промяна. Инсталацията може
да създаде virtual switch/NAT и е извън разрешението без мрежови промени.
Предложение: 8 GiB RAM / 4 vCPU за VM; измерване преди увеличение и SSD резерв
за images, volumes и restore копие.

Desktop е безплатен за лична употреба, обучение, non-commercial open source и
фирми с под 250 служители И под USD 10 милиона годишен оборот. Друга професионална
употреба над лимитите и държавни организации изискват абонамент. MIT лицензът не
доказва право на безплатен Desktop. Категорията/абонаментът се записва локално
преди инсталация; без автоматично приемане на условията със script.

### Фиксирани image кандидати

Registry metadata са проверени без pull; общата таблица по-долу съдържа
linux/amd64 manifests. Това е кандидат-комплект, **не тестван или X5660-съвместим
stack**. Manager 1.30.0 изисква Keycloak >=26.7.0; 26.7.3.0 изпълнява това условие.
Не е намерен сертификат за съвместимост на целия комплект. CPU/runtime проверките
остават задължителни. API се build-ва от main commit и package-lock.json;
`node:22-alpine` още изисква точен съвместим digest и запис на локалния image ID.

### Staging override за реализация

Да се създадат `compose.staging.yml` и launcher, който винаги подава двата Compose
файла, изричен локален env и project `gridex-staging`. Никога само base Compose:
той публикува HTTP/HTTPS на всички интерфейси и изисква VPN bind за MQTT.
Изпълнимият override се отлага до решаване на CPU image/OIDC блокерите;
документът не е изпълнима рецепта за старт.

- Proxy ports се заменят с `!override`: само `127.0.0.1:80:80` и
  `127.0.0.1:443:443`. API HTTP: `127.0.0.1:8081:8080` за локални API test clients.
  Без MQTT 1883/8883, database, metrics или IPv6 wildcard публикации.
- Compose >=2.24.4. Interpolation е преди merge: несекретен локален sentinel
  `VPN_BIND_ADDRESS=127.0.0.1` за base parsing, после проверка, че merged model
  НЯМА MQTT публикация. Sentinel никога не разрешава base-only старт.
- Шестте услуги са в една project-scoped `internal: true` bridge мрежа. Без external
  networks, host networking, extra_hosts/host gateways, privileged mode, devices,
  Docker socket, VPN mounts или физически endpoints. Проверка на реалния egress
  в Docker Desktop без проби към реални устройства.
- Нови project-scoped volumes за двете бази, manager-data и proxy-data. Deployment
  mounts се заменят с ignored staging директория само с проверен branding/празен
  setup. Без production volumes, inventories или Agents.
- Pull/build преди runtime изолация. Изключени demo/auto-provisioning, setup replay
  при рестарт, външни mail/webhooks и физически Agents/rules. Проверка за празни
  Agents/rules преди fixtures. Фиксирани `GRIDEX_WRITES_ENABLED=false`,
  `GRIDEX_AUTO_MIGRATE=false`; изключена memory база. API locks сами не изолират
  собствените control пътища на OpenRemote.
- API healthcheck чрез Node fetch на `/health`; проверка на наследените проверки
  на pinned images и добавяне за proxy при липса. `/health` проверява само Manager
  HTTP достъпност, не database/schema/auth готовност.
- Премахване на legacy Keycloak environment; за 26.7:
  `KC_BOOTSTRAP_ADMIN_PASSWORD` и `KC_HOSTNAME=https://localhost/auth`.
  Еднакви localhost/443; проверка на redirects със запазена TLS/issuer validation.

### Локални secrets и OIDC bootstrap

Operator-only директория извън Git или изрично ignored staging storage;
проверка на ignore и Windows ACLs преди secrets. Текущият `.gitignore` игнорира
`.env`, не произволен `.env.staging`. Без resolved Compose env, tokens, inspect
с credentials или dumps в logs/PRs. Локални secrets: `OR_ADMIN_PASSWORD`,
`GRIDEX_DATABASE_PASSWORD`, `OPENREMOTE_SERVICE_CLIENT_SECRET` и отделна
OpenRemote DB парола за `POSTGRES_PASSWORD`, `KC_DB_PASSWORD`, `OR_DB_PASSWORD`.
Проверка на променливите в избраните images и замяна на upstream sample credentials.
TLS keys, Manager Keycloak grant files, exports и backups остават локално.
Без предположение за `_FILE`; environment е видим за Docker administrators.

След условията: двете DB, Keycloak, Manager, после proxy с празни staging
volumes/setup. Доверяване само на проверения локален сертификат или одобрен такъв;
без global TLS bypass. Синтетичен `gridex` realm през поддържания OpenRemote realm
flow за необходимите clients/roles. Проверка на Keycloak admin и Manager login.
Discovery issuer: `https://localhost/auth/realms/gridex`.

Public `gridex-portal` с Authorization Code + PKCE S256, точен loopback redirect
URI за local harness, точен web origin, без wildcard/implicit/password grant или
client secret. Audience mapper `gridex-portal` и роли от `auth.mjs`.
Confidential `gridex-api` със service accounts и минимални synthetic Asset read
permissions, не realm-admin. Secret се записва локално преди API старт.
Две синтетични организации/Обекти и memberships с реални Keycloak `sub`:
realm роли сами не дават достъп до Обект. Test users: viewer, operator,
administrator и потребител без application role.

**Main API блокер:** `getServiceToken()` изпраща към `OIDC_ISSUER`; localhost
там е самият API контейнер. Кодът поддържа `OIDC_JWKS_URI`, но Compose не го подава.
Планира се фокусирана тествана промяна с изричен вътрешен token endpoint и запазена
външна issuer validation. Предложените, неимплементирани стойности са общият code
блок в английската секция: OIDC_ISSUER към localhost, JWKS/token към keycloak:8080,
OPENREMOTE_BASE_URL към manager:8080. Тест на вътрешните token requests и отказ при
грешен issuer/audience. Internal HTTP остава в изолираната мрежа. Без несвързан
issuer hostname или изключване на certificate validation като обход.

### Миграции и приемане

`repository.migrate()` изпълнява само `001_gridex_core.sql`; няма ledger или
автоматична `002_olimex_edge_hardware.sql`. Нова 001 вече има constraints от 002.
Auto-migrate остава off. Изрично 001, после 002 към празната staging DB с
`psql ON_ERROR_STOP=1`, container stdin/копирани файлове, без shell SQL interpolation.
Всеки файл има transaction; спиране при грешка. Проверка на tables, foreign keys,
gateway role/transport constraints; локален запис на hashes/реда. Повторение върху
disposable restore копие. Това не е production migration runner. OpenRemote/
Keycloak управляват schemas в тяхната обща DB, отделна от gridex-db; проверка на
schema ownership и boot logs.

После API с локалния client secret и Compose `up --wait` с ограничен timeout
(например 600 секунди). Диагностика без изтриване на volumes/нулиране на credentials.
Еднакви project/env/files за всяка команда.
**Всички runtime приемателни проверки са НЕИЗПЪЛНЕНИ.**

| Проверка | Необходими доказателства |
|---|---|
| Linux/CPU | Engine отчита linux; pinned безвреден контейнер работи с --network none; одобрен Manager java -version работи на CPU преди stack; запис на Docker/Compose/image IDs. |
| Compose | config --quiet успява; локален merged model преглед без secrets в logs: шест услуги, трите loopback bindings, без MQTT, отделни volumes/internal network, writes false, без host/device escape. |
| Health | Шест healthy услуги без restart loop; /health=200 и writesEnabled=false; отделни DB/schema queries. |
| Вход | Keycloak admin и Manager browser login/logout, правилни discovery/redirects/TLS; service token без отпечатване. |
| API права | Липсващ/изтекъл/грешно подписан token или грешен issuer/audience: 401; валиден /api/v1/me: 200; без роля /api/v1/device-types: 403; viewer read: 200; недостъпен Обект: 404; правилно membership filtering. |
| Locks | Viewer control: 403; разрешен operator: 423 writes_locked, само synthetic Site/control fixtures и contract-valid payload. Проверка на validation реда. Никога включване на writes или контакт с устройства заради тест. |
| Изолация | Проверка на ports/networks и празни physical Agents/rules; blocked egress с operator-owned инертна test цел, никога физическо устройство. |
| Persistence | API preferences и несвързан безвреден OpenRemote Asset; IDs/revisions/counts. Restart, после down/up БЕЗ -v: данни/users/roles се пазят, без setup replay. |
| Restore | Нов изолиран restore project минава login, rights, fixture/revision/count сравнения и write lock; изходните volumes остават. |

Preferences/drafts се пазят и с writes off: не е глобален DB read-only switch.
Само синтетични fixtures; ROCK Pi/ESP32 достъп не е необходим.

Backup проба: спиране на API/Manager/Keycloak writers и proxy, DBs остават.
Dump на gridex-db и всички non-template DBs плюс roles/globals в OpenRemote
PostgreSQL, включително Keycloak, със съответстващи pg_dump/pg_dumpall. Файлове в
контейнерите, после docker cp към ACL-защитен local storage; без Windows PowerShell
binary redirection. Архив на manager-data/proxy-data със спрени writers и запазен
ownership. Включени защитени local secrets/certificates/deployment config/image
references/migration hashes. Проверка на dump/archive integrity. Спиране на source
stack за loopback портовете; restore на roles/DBs/archives в нови volumes под
`gridex-staging-restore` със същите images. Без сляпо setup/migration replay.
Повторение на приемането. Без `down -v` или изтриване; изходните volumes се пазят.
Тази проба не е production backup политика.

### Ред за реализация

1. Решаване на CPU image, Docker OS support/patching и license категория.
2. Override/guard, local ignore, exact API base, Keycloak bootstrap и вътрешен
   token endpoint с фокусирани тестове в implementation PR.
3. Merged Compose validation на съвместим Docker; EN/BG и secrets review.
4. Само след разрешение за инсталация/старт: приемане и резултати без чувствителни
   данни. CODEX_STATE.md и HANDOFF.md остават актуални за всеки блокер.

## Shared image references / Общи image references

| Service | Reference |
|---|---|
| manager | openremote/manager:1.30.0@sha256:dc1f468022aeddfb3efabf30f5be3aef27ebf0875ae7ff673c00dafb9d191daf |
| keycloak | openremote/keycloak:26.7.3.0@sha256:5e5ee2899c56c941f3531818e71ea1dbcc70b4761cc32306e550bbc21af56e27 |
| postgresql | openremote/postgresql:17.9.0.1-slim@sha256:1622df4e31a0492e40d44920592264e2400adf7295fa68c6a63135a5ce7ffaf7 |
| proxy | openremote/proxy:3.2.19.0@sha256:38a5c565b6840826dcd4da86249ee29cc384f18e3caa15e70feedc6971fbeea0 |
| gridex-db | postgres:17.9-alpine@sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609 |

## Sources / Източници

Checked / Проверени: 2026-09-14.

- [Docker requirements](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Docker releases](https://docs.docker.com/desktop/release-notes/#4900)
- [Docker license](https://docs.docker.com/subscription-billing/desktop-license/)
- [Windows lifecycle](https://learn.microsoft.com/en-ca/lifecycle/announcements/windows-10-22h2-end-of-support-update)
- [OpenRemote 1.30.0](https://github.com/openremote/openremote/releases/tag/1.30.0)
- [Manager Dockerfile](https://github.com/openremote/openremote/blob/1.30.0/manager/Dockerfile)
- [Manager 1.23.0](https://github.com/openremote/openremote/blob/1.23.0/manager/Dockerfile)
- [Keycloak image source](https://github.com/openremote/keycloak/blob/main/Dockerfile)
- [Red Hat x86-64-v3](https://developers.redhat.com/articles/2024/01/02/exploring-x86-64-v3-red-hat-enterprise-linux-10)
- [Intel X5660](https://www.intel.de/content/www/de/de/products/sku/47921/intel-xeon-processor-x5660-12m-cache-2-80-ghz-6-40-gts-intel-qpi/specifications.html)
- [Compose merging](https://docs.docker.com/reference/compose-file/merge/)
- [Compose networks](https://docs.docker.com/reference/compose-file/networks/)
- [Keycloak hostname](https://www.keycloak.org/server/hostname)
- Registry: [manager](https://hub.docker.com/v2/repositories/openremote/manager/tags/1.30.0), [keycloak](https://hub.docker.com/v2/repositories/openremote/keycloak/tags/26.7.3.0), [postgresql](https://hub.docker.com/v2/repositories/openremote/postgresql/tags/17.9.0.1-slim), [proxy](https://hub.docker.com/v2/repositories/openremote/proxy/tags/3.2.19.0), [gridex-db](https://hub.docker.com/v2/repositories/library/postgres/tags/17.9-alpine).
