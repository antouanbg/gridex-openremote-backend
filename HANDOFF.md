# Handoff — GrideX OpenRemote backend

Repository / GitHub: `antouanbg/gridex-openremote-backend`

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
