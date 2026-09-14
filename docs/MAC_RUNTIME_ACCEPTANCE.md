# Mac runtime acceptance checkpoint

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## English — 2026-09-14

This is the current status; earlier research and checkpoint documents are
historical where they say the runtime or OIDC clients are not installed.

| Item | Evidence / status |
|---|---|
| Linux/Docker | Colima gridex ARM64, Ubuntu 24.04.4, Engine 29.5.2 |
| Core stack | Six healthy containers, loopback-only published proxy/API |
| GrideX database | Explicit migrations 001 and 002 committed |
| OIDC service | Realm created through Manager; real read:assets token query passed |
| Portal client | Authorization code/PKCE S256 configured; password grant disabled |
| API authorization | Real signed JWT/JWKS and PostgreSQL membership test passed: own site 200, other tenant 404, filtered list, invalid token 401 |
| API tests | 12/12 passed outside bind-restricted sandbox |
| Portainer | CE 2.45.0 ARM64, loopback 9443; owner confirmed seeing containers |
| Browser login/logout | Pending: localhost certificate warning requires owner action; no successful portal login claimed |
| WireGuard | Not configured; no Site Router peer supplied; no WG on ROCK Pi/ESP |
| MQTT ingestion | No real broker receipt accepted yet |
| Backup/restore | Not executed; remains required before production |

Tenancy test uses a temporary service-account JWT, not a browser session. It
creates two synthetic organizations/sites, grants membership to one, checks
the running API, then removes its own rows and client. It does not certify
all per-organization role combinations, suspended membership handling or a
physical device control path. Keep writes disabled.

Artifacts: `compose.mac.yml` (standalone staging), `compose.portainer.yml`
(reproduction, existing container was installed via docker run),
`scripts/prepare-mac-runtime.py`, `scripts/provision-mac-oidc.mjs`,
`scripts/test-mac-tenancy.mjs`. Node scripts run inside the API container from
its `/app` working directory and take the protected runtime settings JSON on
stdin. Never paste secrets into command arguments, Git, PRs or browser URLs.
The provisioning script preserves existing clients; it does not reconcile
their drift. An interrupted bootstrap can leave a temporary client: inspect
only `gridex-bootstrap-*` clients and remove a confirmed orphan before retry.

Portainer setup lessons: initial setup can expire; restarting only Portainer
reopens it and generates a new setup token. Use the latest token locally.
The earlier HTTP 403 cause was not established; do not label it a verified
token fault. The owner creates credentials in the UI. Keep Docker socket
administration local; never publish ports 8000/9000. Do not claim Portainer
is read-only. Its volume and credentials must be included in a future backup.

Next: owner handles localhost certificate, then browser PKCE login/logout;
backup/restore in an isolated project; backend VPN preparation and Site Router
commissioning; private MQTT identity and real ingestion. Draft feature PRs are
not implicitly deployed by this runtime change. Production is not approved.

## Български — 2026-09-14

Това е актуалният статус; старите проучвания/checkpoint-и са исторически,
когато посочват, че runtime или OIDC клиентите не са инсталирани.

| Елемент | Доказателство / статус |
|---|---|
| Linux/Docker | Colima gridex ARM64, Ubuntu 24.04.4, Engine 29.5.2 |
| Основен стек | Шест healthy контейнера, proxy/API само на loopback |
| GrideX база | Изрично приложени и commit-нати миграции 001 и 002 |
| OIDC service | Realm през Manager; реална read:assets token заявка е успешна |
| Portal клиент | Authorization code/PKCE S256; password grant изключен |
| API права | Реален подписан JWT/JWKS и PostgreSQL membership: свой обект 200, чужд 404, филтриран списък, невалиден token 401 |
| API тестове | 12/12 извън sandbox с bind ограничения |
| Portainer | CE 2.45.0 ARM64, loopback 9443; собственикът потвърди видими контейнери |
| Browser вход/изход | Предстои: localhost certificate warning изисква собственика; успешен portal вход не е заявен |
| WireGuard | Не е конфигуриран; няма Site Router peer; без WG върху ROCK Pi/ESP |
| MQTT ingestion | Няма прието реално получаване от broker |
| Backup/restore | Не е изпълнен; задължителен преди production |

Tenancy тестът ползва временен service-account JWT, не browser сесия. Създава
две synthetic организации/обекти, membership само към едната, проверява
работещия API и премахва собствените си записи/клиент. Не сертифицира всички
комбинации от роли по организации, suspended membership или физическо
управление. Записите остават забранени.

Артефакти: `compose.mac.yml` (самостоятелен staging), `compose.portainer.yml`
(възпроизвеждане; наличният контейнер е стартиран с docker run),
`scripts/prepare-mac-runtime.py`, `scripts/provision-mac-oidc.mjs`,
`scripts/test-mac-tenancy.mjs`. Node скриптовете се изпълняват в API контейнера
от `/app`, с JSON от защитените runtime настройки през stdin. Без secrets в
command arguments, Git, PR или browser URL. Provisioning пази наличните
клиенти, но не коригира разминавания в тях. Прекъснат bootstrap може да остави
временен клиент: провери само `gridex-bootstrap-*` и премахни потвърден orphan.

Portainer уроци: initial setup може да изтече; рестарт само на Portainer го
отваря отново и генерира нов setup token. Ползвай последния token локално.
Причината за предходния 403 не е установена; не го описвай като доказана token
грешка. Собственикът създава credentials в UI. Docker socket администрацията
остава локална; без публикувани 8000/9000. Portainer не е read-only. Неговият
volume и credentials трябва да участват в бъдещия backup.

Следва: собственикът обработва localhost сертификата, после browser PKCE
вход/изход; backup/restore в отделен проект; backend VPN подготовка и Site
Router commissioning; private MQTT identity и реален ingestion. Draft feature
PR-ите не са автоматично внедрени с runtime промяната. Няма production одобрение.
