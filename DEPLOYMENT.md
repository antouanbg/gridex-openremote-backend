# GrideX deployment and knowledge-transfer baseline

Repository: `antouanbg/gridex-openremote-backend`
Status: **planning/runbook draft, not a certified clean-room installation**. This document does not authorise production migration, device commissioning or control writes.

## English

### Scope and sources of truth

This is the entry point for recreating the GrideX platform on another host or cloud. It covers the [backend](https://github.com/antouanbg/gridex-openremote-backend), [portal](https://github.com/antouanbg/gridex-energy-os) and [Edge](https://github.com/antouanbg/gridex-edge-gateway). Use the exact reviewed Git revisions and record them in the installation log; do not mix an Edge feature branch with backend/frontend `main` without compatibility tests. The [backend README](README.md) explains the components, [HANDOFF](HANDOFF.md) and [CODEX_STATE](CODEX_STATE.md) track current rollout and open gates, and [AGENTS](AGENTS.md) records owner-approved rules. Older dated handoffs are history, not proof of the present runtime.

OpenRemote is authoritative for realms, Sites, devices and sensor Assets. Keycloak authenticates users; the GrideX API enforces tenant/Site permissions and holds workflow data in a separate PostgreSQL database. OpenRemote history and the dedicated market TimescaleDB are different stores. The portal must never treat an API failure as permission to show demo values to an authenticated user. ROCK Pi/ESP32 remain physically at the Site; moving the backend changes their authorised transport endpoint, not their ownership or safety gates.

### What Git does and does not contain

| In Git | Must be supplied or restored outside Git |
| --- | --- |
| Backend Compose definitions and application source | Operator-maintained private backend `.env`, mode `0600` |
| Portal source, build and Pages workflow | Production DNS, TLS certificates/private keys, exact OIDC origins and callbacks |
| Edge firmware/runtime source and staged-image builder | Per-device certificates/keys, enrolment, site network settings and approved active configuration |
| Migration SQL and provisioning scripts | Database/volume backups, customer inventory, accounts, historical measurements and audit state |

Do not paste secrets, customer data, action URLs or certificates into Git, an AI chat or an unencrypted handoff. Maintain **one** private backend configuration file per deployment, as required by [AGENTS](AGENTS.md); a cloud secret service may protect/deliver that file but must not become an independently maintained second configuration. Record the secret *names, owners, locations, rotation and recovery procedure* in a restricted operator inventory, not their values here.

### Known portability gaps — resolve before promising a new-cloud start

1. [`compose.mac.yml`](compose.mac.yml), [`compose.mqtt.yml`](compose.mqtt.yml) and [the public proxy Compose](deploy/public-https/compose.yml) explicitly use `linux/arm64`. The new host must run these reviewed ARM64 images, or a separately reviewed multi-architecture build and compatibility test is required. Do not silently substitute image tags or digests.
2. The public proxy Compose expects the `gridex-mac_backend` and `gridex-mac_ingress` external Docker networks and local bind/UID/GID values. A new-cloud network/ingress overlay, DNS/TLS renewal and restricted route verification are not yet packaged as a portable profile. OpenRemote Manager must remain behind its portal-session and matching-realm checks.
3. [`.env.example`](.env.example) is **not** a complete deployment manifest. For example, core Compose requires `OR_DATABASE_PASSWORD`, which the example currently omits; public proxy and MQTT require additional host-specific values. Reconcile every required `${...:?}` and selected overlay variable into a sanitised configuration inventory before first boot.
4. There is no demonstrated clean-room restoration of all three persistent databases, Manager state, organisation realms/clients, MQTT identities and Grafana provisioning into a second environment. Git alone cannot reconstruct live customer state. Prove a restore in an isolated project before any cutover.
5. The portal's [runtime config](https://github.com/antouanbg/gridex-energy-os/blob/main/public/gridex-config.js) points to the current public API/auth origins. New origins require coordinated DNS, certificates, Keycloak issuer, portal callbacks/CORS, API and proxy configuration plus browser tests for multiple realms.
6. The Edge [image payload builder](https://github.com/antouanbg/gridex-edge-gateway/blob/main/base-rockpie/install/build-image-payload.sh) stages a binary and service files; it deliberately does not install private device settings or activate the physical ROCK. The currently approved per-Site transport and MQTT mTLS credentials must be migrated and tested separately. Keep battery writes and commissioning locked unless separately approved.

### Ordered migration work package (not an automatic production script)

1. **Freeze an inventory.** Record the exact Git revisions, enabled Compose overlays, running image digests, exposed routes, database/volume names, active realms, service clients, MQTT topic ACLs, Edge versions and Site transport modes. Record whether each item is source-defined, generated, private or only live-configured. Do not copy secret values into the inventory.
2. **Choose the target and preserve isolation.** Document CPU architecture, Docker/Compose version, storage/backup, private and public networks, DNS, certificate issuance/renewal, firewall, outbound services and a rollback route to the existing host. Do not expose databases, MQTT admin routes, Keycloak master/admin or unguarded Manager endpoints.
3. **Prepare private inputs.** Generate/restore the single backend `.env`, certificates, device identities and encrypted backups through a controlled operator process. Map only the secrets needed by each container. Validate that the target has the correct file ownership and no synced/public copies.
4. **Build a disposable environment.** Render the *selected* Compose combination and validate its effective ports, networks, mounts, image architecture and env requirements. Apply reviewed migrations in order; provision OpenRemote/Keycloak and service clients through the documented API/scripts, then check the resulting Assets and permissions. Never create a second inventory outside OpenRemote.
5. **Connect portal and Edge.** Publish the portal only after API/auth origins and realm callbacks work. Enrol one test ROCK with the chosen per-Site transport; verify mTLS identity, heartbeat, selected telemetry and OpenRemote history. Do not change Ethernet or control/OTA behaviour implicitly.
6. **Acceptance and rollback rehearsal.** Test anonymous denial, platform admin, two isolated customer realms, refresh/logout/re-login, invitation/password recovery, Site/device provisioning, MQTT/worker delivery, Grafana entitlement checks, database persistence after restart and restore from backup. Record evidence, revisions, failures and exact rollback steps in [HANDOFF](HANDOFF.md). Only then plan a separately approved live cutover.

### Completion criteria for this document

This file is a starting checklist. Before marking it a runnable deployment guide, add a verified cloud-specific Compose profile and network diagram, a complete sanitised environment matrix, a versioned bootstrap/migration sequence, backup/restore instructions, Edge enrolment procedure, rollback commands and an automated clean-room smoke suite. A second operator must execute it from a fresh environment without using this chat as an undocumented dependency. Until then the status remains **not portable by clone-and-start**.

## Български

### Обхват и източници на истина

Това е входната точка за възстановяване на GrideX на друг хост или облак. Обхваща [backend](https://github.com/antouanbg/gridex-openremote-backend), [портала](https://github.com/antouanbg/gridex-energy-os) и [Edge](https://github.com/antouanbg/gridex-edge-gateway). Записвай точните прегледани Git ревизии; не смесвай Edge функционален клон с backend/frontend `main` без тест за съвместимост. [Backend README](README.md) описва компонентите, [HANDOFF](HANDOFF.md) и [CODEX_STATE](CODEX_STATE.md) — текущото внедряване и отворените проверки, а [AGENTS](AGENTS.md) — одобрените правила. Старите записи са история, не доказателство за текущата среда.

OpenRemote е основният регистър за realm-и, Обекти, устройства и сензорни Assets. Keycloak удостоверява потребителите; GrideX API прилага правата за организация и Обект и пази работните процеси в отделна PostgreSQL база. Историята в OpenRemote и отделната TimescaleDB за пазарните цени са различни хранилища. При API грешка порталът не показва демо данни на логнат потребител. ROCK Pi/ESP32 остават физически на Обекта; преместването на backend-а сменя разрешения транспортен endpoint, не собствеността или защитите.

### Какво има и какво няма в Git

| В Git | Извън Git — осигуряване или възстановяване |
| --- | --- |
| Backend Compose и приложен код | Единният частен backend `.env` с права `0600` |
| Код, build и Pages workflow на портала | DNS, TLS сертификати/частни ключове, точни OIDC адреси и callbacks |
| Edge firmware/runtime и builder за образ | Сертификати/ключове по устройство, enrolment, локална мрежа и одобрена активна конфигурация |
| SQL миграции и скриптове за провизиране | Архиви на бази/volumes, клиентски инвентар, акаунти, история и одит |

Не поставяй тайни, клиентски данни, action URL или сертификати в Git, AI чат или некриптиран handoff. Поддържай **един** частен backend конфигурационен файл за всяко внедряване според [AGENTS](AGENTS.md). Облачна услуга за тайни може да защитава/доставя този файл, но не и да създава втори независим източник на настройки. В защитен операторски регистър запиши *имената, отговорниците, местата, ротацията и възстановяването* на тайните, не стойностите им тук.

### Известни пречки пред преместването

1. [`compose.mac.yml`](compose.mac.yml), [`compose.mqtt.yml`](compose.mqtt.yml) и [Compose за публичното proxy](deploy/public-https/compose.yml) изрично използват `linux/arm64`. Новият хост трябва да пуска проверените ARM64 образи или да има отделно прегледан multi-architecture build и тест. Не сменяй тихомълком версии/digest-и.
2. Публичното proxy очаква външните Docker мрежи `gridex-mac_backend` и `gridex-mac_ingress`, както и стойности за bind адрес и UID/GID. Преносим облачен профил за мрежи/вход, DNS/TLS обновяване и проверка на ограничените маршрути още няма. OpenRemote Manager остава защитен с портална сесия и проверка за същия realm.
3. [`.env.example`](.env.example) **не е** пълен списък за внедряване. Основният Compose например изисква `OR_DATABASE_PASSWORD`, която липсва от примера; публичното proxy и MQTT имат още настройки за хоста. Преди първи старт сравни всички задължителни `${...:?}` и избраните overlays с обезличен конфигурационен регистър.
4. Няма доказано възстановяване от нулата в друга среда на трите постоянни бази, Manager state, организационните realm-и/clients, MQTT идентичностите и Grafana provisioning. Git не може сам да възстанови реалните клиентски данни. Първо докажи restore в изолиран проект.
5. [Настройките на портала](https://github.com/antouanbg/gridex-energy-os/blob/main/public/gridex-config.js) сочат към сегашните публични API/auth адреси. Новите адреси изискват съгласувани DNS, сертификати, Keycloak issuer, callbacks/CORS, API и proxy настройки и browser тестове с няколко realm-а.
6. [Builder-ът на Edge образа](https://github.com/antouanbg/gridex-edge-gateway/blob/main/base-rockpie/install/build-image-payload.sh) само подготвя binary и service файлове; умишлено не инсталира частните настройки и не активира физическия ROCK. Избраният транспорт по Обект и MQTT mTLS се прехвърлят и проверяват отделно. Записите към батерията и commissioning остават заключени без отделно одобрение.

### Последователен пакет за миграция (не автоматичен production скрипт)

1. **Опис на средата.** Запиши Git ревизии, активни Compose overlays, image digest-и, публични маршрути, бази/volumes, realm-и, service clients, MQTT topic ACL, Edge версии и транспорт по Обект. За всяко отбележи дали идва от кода, генерира се, частно е или съществува само на живо. Без стойности на тайни.
2. **Избор на цел и изолация.** Опиши архитектурата на CPU, Docker/Compose, съхранение/архиви, частни и публични мрежи, DNS, издаване/подновяване на сертификати, firewall, изходящи услуги и план за връщане към стария хост. Без публични бази, MQTT admin, Keycloak master/admin или незащитен Manager.
3. **Частни входни данни.** С контролиран операторски процес генерирай/възстанови единния backend `.env`, сертификати, идентичности на устройства и криптирани архиви. Подай на всеки контейнер само нужните му тайни. Провери собствеността на файловете и липсата на публични/синхронизирани копия.
4. **Временна изолирана среда.** Провери ефективната комбинация от избраните Compose файлове — портове, мрежи, mounts, архитектура и env. Приложи прегледаните миграции в ред; провизирай OpenRemote/Keycloak и service clients през описаните API/скриптове, после провери Assets и права. Не създавай втори инвентар извън OpenRemote.
5. **Свържи портала и Edge.** Публикувай портала след успешни API/auth адреси и callbacks за realm-ите. Включи един тестов ROCK с избрания транспорт; провери mTLS, heartbeat, телеметрията и историята в OpenRemote. Не променяй мълчаливо Ethernet, управление или OTA.
6. **Приемане и връщане назад.** Тествай отказ за анонимен достъп, глобален администратор, два изолирани клиентски realm-а, refresh/logout/нов вход, покана/парола, Обект/устройство, MQTT/worker, права за Grafana, съхранение след рестарт и restore. Запиши доказателства, ревизии, грешки и точните стъпки за връщане в [HANDOFF](HANDOFF.md). Едва тогава планирай отделно одобрено преместване на живо.

### Кога документът е завършен

Това е начален контролен списък. За работещ инсталационен наръчник трябват проверен облачен Compose профил и мрежова схема, пълна обезличена матрица на настройките, версиониран ред за bootstrap/миграции, backup/restore, Edge enrolment, rollback и автоматичен тест от чиста среда. Втори оператор трябва да го изпълни без скрити инструкции от този чат. Дотогава статусът е **непреносим само със сваляне и стартиране**.
