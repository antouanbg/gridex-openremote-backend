# Handoff — GrideX OpenRemote backend

Repository / GitHub: `antouanbg/gridex-openremote-backend`

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
