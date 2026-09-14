# Linux under macOS backend handoff

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## English

### Decision and verified baseline — 2026-09-14

The owner stopped Windows experiments and selected Linux under the existing Mac
as the active backend development/staging target. Do not continue the Windows,
Hyper-V, X5660 custom Manager or cloud-host paths from PRs #10–#13 without a new
request. Preserve those PRs as history; their generic OIDC/isolation/migration
findings remain useful. No production host migration or VPN commissioning is
claimed. Existing runtime code still targets main `279745b`.

Read-only host evidence: Apple M4 Pro, 14 CPU cores, 64 GB RAM, macOS 26.6.2
arm64, approximately 1.6 TiB available storage. Homebrew exists; Docker and
Colima commands were not found on PATH and no Docker Desktop application was
found in /Applications. No installer, container, VM or live-device operation
was run by this documentation task. Hardware identifiers are intentionally omitted.

Selected runtime: **Colima-managed Linux ARM64 VM → Docker Engine → Compose**,
using Apple's Virtualization framework (`vz`), native aarch64 and Docker runtime.
Use a named `gridex` profile; proposed budget is 8 vCPU / 16 GiB RAM / 150 GiB
virtual disk. Retain macOS as host. Use Colima's release-managed Linux guest;
record its actual `/etc/os-release`, kernel and Docker server version at setup,
rather than claiming a particular Ubuntu/Debian release before installation.
No amd64 emulation, Rosetta, Kubernetes or custom Manager rebuild is planned.

Homebrew formula versions observed (available, not installed): Colima 0.10.3,
Lima 2.2.0, Docker CLI 29.8.0, Compose 5.5.1, Buildx 0.37.1. The CLI version does
not prove the guest Engine version. Verify server/CLI/plugin interoperability
after installation and record the actual versions. Use Colima/Engine licensing;
Docker Desktop is not selected.

### Image compatibility evidence

Docker Hub tag metadata was queried directly for every row below. Each has a
`linux/arm64` image. These are version candidates with locked ARM64 manifest
digests, **not a runtime-certified or vulnerability-reviewed stack**. M4 avoids
the x86-64-v3 instruction mismatch by selecting ARM64 images, but Java, native
extensions and application startup still require target-host tests. Never use
an amd64 child digest from the Windows research.

| Component | Candidate | ARM64 manifest SHA256 |
|---|---|---|
| Manager | openremote/manager:1.30.0 | dcf6c4554a99c9afc3c0fc8d03d8d896d376b36c3f49d31e8a35c38c065355aa |
| Keycloak | openremote/keycloak:26.7.3.0 | ed06ad3dd3bcb95bc58ffe59729d5c4064f2276cce43b299949f816c89c2d027 |
| OpenRemote DB | openremote/postgresql:17.9.0.1-slim | c96d3da9b842d7f383bd06ef0ccdf67f4052d74c03f268f547f879a89109241b |
| Proxy | openremote/proxy:3.2.19.0 | 5233fe75c8fe2c4cdecc7236c7d1d61adfc6421abbb7abf7f3da1a315c4c5246 |
| GrideX DB | postgres:17.9-alpine | faf1338f88c8da3c81a87ebea9d49455e27523f867fee461b9cc1325af200ef3 |
| API build base | node:22-alpine | 1ef15d33d74602021f35ec64a4e72f4a21e2cfa68ebecd125fbe0c44af8f604a |

Use `image:tag@sha256:<digest>` and `platform: linux/arm64` in the implementation.
The API still needs a local ARM64 build from its package-lock and pinned base;
there is no prebuilt validated GrideX API image. Retain Manager 1.30.0 application
version; validate its Keycloak/provider/database combination with real startup.

### Ordered implementation handoff

1. **Runtime.** Install Colima, Docker CLI, Compose and Buildx via Homebrew;
   preserve any existing Docker config while registering CLI plugins. Create
   only the named `gridex` profile with the budget above. Explicitly target its
   discovered Docker context in every command. Verify `linux/aarch64`, server
   version, `docker compose version`, buildx and a harmless ARM64 container.
2. **Private storage.** Keep VM disk, database named volumes, secrets and backup
   dumps outside Google Drive/iCloud-synced directories. Use a non-synced local
   checkout for builds; never bind-mount a live PostgreSQL data directory from
   this Drive workspace. Store generated credentials in operator-only local
   files. Do not overwrite existing Docker contexts, SSH keys or credentials.
3. **Executable staging configuration.** Add a separate Mac override and guarded
   launcher for project `gridex-mac-staging`. Replace published ports using
   Compose `!override`: proxy loopback HTTP/HTTPS and API loopback only. Remove
   MQTT publication; provide a loopback placeholder solely for base-file
   interpolation, then assert the merged config has no MQTT listener. Confirm
   the ports are free before choosing the fixed localhost/443 OIDC origin.
   Use an internal container network, fresh volumes, synthetic assets and a
   reviewed minimal deployment directory. No physical Agents, WAN exposure,
   VPN mount, host networking or device routing. Verify actual macOS forwarding
   binds, not just guest binds. Set writes and automatic migrations false.
4. **API/OIDC/migrations.** Fix service-token retrieval to use an explicit
   internal Keycloak token endpoint; expose existing JWKS configuration through
   Compose while preserving external HTTPS issuer/audience validation. Configure
   correct Keycloak 26 bootstrap/hostname variables, clients, service-account
   permissions, test roles and memberships. Main `repository.migrate()` runs
   only 001: execute reviewed 001 then 002 against a fresh database with stop-on-
   error and record hashes. Test schema constraints and repeatability. Keep
   these changes separate from the platform choice and reconcile PRs #3–#6.
5. **Acceptance.** Run both JVM version probes, database init/extension queries,
   proxy health and API build; start all six services without restart loops.
   Verify login/logout, valid API reads, invalid token 401, unauthorized tenant
   rejection and locked synthetic control. Confirm no physical-device traffic.
   Restart the profile and containers, prove persistence; restore both DBs and
   required app volumes into a separate project and compare fixtures. Never use
   `down -v` on the source project. Record backup/restore and disk-growth evidence.
6. **Remaining services.** Review configuration/outbox, health ingestion and
   market-data PRs individually. Main has no standalone journal recovery worker
   or dedicated GrideX Timescale service. Do not confuse OpenRemote DB extensions
   with the GrideX schema. Private MQTT ingestion, journal export/ACK, market/
   weather scheduling and forecasting need separate implementation/acceptance.
   Site Router VPN and frontend integration follow local acceptance; Mac staging
   does not authorize exposing OT devices or replacing per-site WireGuard peers.

Statistics for this handoff only: 6 implementation milestones, 0 completed,
6 pending; research/documentation complete, runtime acceptance 0 performed.
This does not replace or reset the nine-task backlog in PR #9. Exact next action:
implement milestone 1 in a deployment task, then prepare milestone 3 before any
base Compose startup. The current task produces documentation and a PR only.

## Български

### Решение и проверена основа — 2026-09-14

Собственикът спря Windows експериментите и избра Linux под наличния Mac за
активна backend разработка и staging. Windows/Hyper-V, custom Manager за X5660
и cloud-host вариантите от PR #10–#13 не продължават без ново искане. PR-ите се
пазят като история; общите OIDC, isolation и migration изводи остават полезни.
Не се заявява production миграция или VPN commissioning. Основата е main `279745b`.

Проверено само чрез четене: M4 Pro, 14 CPU ядра, 64 GB RAM, macOS 26.6.2 arm64,
около 1.6 TiB свободно място. Има Homebrew; Docker/Colima не са намерени в PATH,
нито Docker Desktop в /Applications. Няма инсталиране, старт на VM/контейнери или
операции към устройства в тази задача. Хардуерни идентификатори не се публикуват.

Избрано: **Linux ARM64 VM чрез Colima → Docker Engine → Compose**, Apple
Virtualization (`vz`), native aarch64, Docker runtime. Профил `gridex` с начален
бюджет 8 vCPU / 16 GiB RAM / 150 GiB виртуален диск. macOS остава host. Използва
се управляваният от Colima Linux guest; при инсталиране се записват действителните
`/etc/os-release`, kernel и Docker server версии, без предварително твърдение за
Ubuntu/Debian версия. Не се планират amd64 емулация, Rosetta, Kubernetes или
custom Manager rebuild.

Налични Homebrew версии, още неинсталирани: Colima 0.10.3, Lima 2.2.0, Docker CLI
29.8.0, Compose 5.5.1, Buildx 0.37.1. CLI версията не доказва Engine версията в
guest. След инсталация се проверява съвместната работа и се записват версиите.
Използват се лицензите на Colima/Engine; Docker Desktop не е избран.

### Съвместимост на образите

Общата таблица в английската секция съдържа проверените директно в Docker Hub
версии и ARM64 manifest SHA256. Всичките шест имат `linux/arm64` вариант. Това
са фиксирани кандидати, **не runtime-сертифициран или security-проверен стек**.
ARM64 изборът избягва x86-64-v3 несъвместимостта на Xeon; JVM, native extensions
и приложението още изискват тест. Да не се използват amd64 child digests от
Windows проучването. Формат: `image:tag@sha256:<digest>` и `platform: linux/arm64`.
API трябва да се build-не от package-lock и фиксирана база; няма проверен готов
API image. Запазва се Manager 1.30.0; Keycloak/providers/DB се тестват заедно.

### Последователност за реализация

1. **Runtime:** Homebrew Colima, Docker CLI, Compose, Buildx; запазване на Docker
   config при регистрация на plugins. Само профил `gridex` с горния бюджет;
   изричен открит Docker context във всяка команда. Проверки за linux/aarch64,
   server/Compose/buildx и безвреден ARM64 контейнер.
2. **Локално съхранение:** VM, named DB volumes, secrets и backups извън Google
   Drive/iCloud. Несинхронизиран checkout за build; без live PostgreSQL bind mount
   от Drive. Credentials в локални файлове само за оператора. Запазване на
   налични Docker contexts, SSH ключове и credentials.
3. **Staging:** отделен Mac override и guarded launcher, `gridex-mac-staging`.
   `!override` заменя ports с loopback HTTP/HTTPS/API. MQTT публикацията се
   премахва; loopback placeholder служи само за base interpolation и се проверява
   крайният модел. Проверка за свободни localhost/443 портове преди OIDC настройка.
   Internal network, нови volumes, синтетични Assets и минимален deployment.
   Без physical Agents, WAN публикация, VPN mounts, host network или device routing.
   Проверка на реалните Mac forwarding bindings; writes/auto-migrate=false.
4. **API/OIDC/миграции:** вътрешен Keycloak token endpoint, JWKS през Compose,
   запазена външна HTTPS issuer/audience validation. Коректен Keycloak 26 bootstrap,
   hostname, clients, service-account права, test роли/memberships. Main изпълнява
   само 001 автоматично; прегледани 001 и 002 към празна DB със stop-on-error и
   hashes. Тест на constraints и повторяемост; съгласуване с PR #3–#6.
5. **Приемане:** JVM probes, DB init/extensions, proxy health, API build; шест
   здрави услуги без restart loops. Login/logout, валидни API reads, 401 при
   невалиден token, отказ за чужд tenant и locked synthetic control. Без трафик
   към устройства. Restart на profile/containers, persistence и restore на двете
   DB/app volumes в отделен project със сравнение на fixtures. Без source
   `down -v`; запис на backup/restore и растеж на диска.
6. **Оставащи услуги:** отделен review на configuration/outbox, health ingestion
   и data PR-и. Main няма standalone journal recovery worker или dedicated GrideX
   Timescale услуга. OpenRemote DB extensions не са GrideX schema. Private MQTT
   ingestion, journal export/ACK, market/weather scheduling и forecasting изискват
   отделни реализации и тестове. Site Router VPN и frontend интеграцията идват
   след локално приемане; не се отварят OT устройства и не се заменят Site peers.

Статистика само за този handoff: 6 implementation етапа, 0 завършени, 6 оставащи;
проучването/документацията са готови, runtime приемателни проверки: 0. Не заменя
деветте задачи от PR #9. Точна следваща стъпка: етап 1 в deployment задача,
после подготовка на етап 3 преди какъвто и да е base Compose старт. Тази задача
създава само документация и PR.

## Sources / Източници

- [Colima official repository](https://github.com/abiosoft/colima)
- [Homebrew Colima](https://formulae.brew.sh/formula/colima)
- [Homebrew Docker CLI](https://formulae.brew.sh/formula/docker)
- [Homebrew Compose](https://formulae.brew.sh/formula/docker-compose)
- [Homebrew Buildx](https://formulae.brew.sh/formula/docker-buildx)
- [Manager ARM metadata](https://hub.docker.com/v2/repositories/openremote/manager/tags/1.30.0)
- [Keycloak metadata](https://hub.docker.com/v2/repositories/openremote/keycloak/tags/26.7.3.0)
- [OpenRemote DB metadata](https://hub.docker.com/v2/repositories/openremote/postgresql/tags/17.9.0.1-slim)
- [Proxy metadata](https://hub.docker.com/v2/repositories/openremote/proxy/tags/3.2.19.0)
- [GrideX DB metadata](https://hub.docker.com/v2/repositories/library/postgres/tags/17.9-alpine)
- [Node metadata](https://hub.docker.com/v2/repositories/library/node/tags/22-alpine)
- [Windows research PR #11](https://github.com/antouanbg/gridex-openremote-backend/pull/11)
