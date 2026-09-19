# GrideX OpenRemote backend — Working rules

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
