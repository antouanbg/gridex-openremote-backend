# GrideX backend

GrideX is an energy-management platform for sites, equipment and measured data. This repository contains the OpenRemote-based backend, GrideX API, integration workers and deployment definitions. The [web portal](https://github.com/antouanbg/gridex-energy-os) and [ROCK Pi/ESP32 edge software](https://github.com/antouanbg/gridex-edge-gateway) are maintained separately. The project is open source under the MIT License; see [project credits](CREDITS.md).

## Architecture

```text
GrideX portal → HTTPS proxy → GrideX API → OpenRemote Manager / Keycloak
                                  │                 │
                                  └→ GrideX DB      └→ OpenRemote DB + TimescaleDB

Site equipment → ESP32/ROCK Pi → MQTT with mTLS → workers → OpenRemote Assets/history
```

- **OpenRemote is the source of truth for operational inventory:** organisations' realms, Sites, gateways, devices, sensors, attributes and their relationships. Historical measurements are stored in its PostgreSQL/TimescaleDB. No resource is considered provisioned solely because it exists in a GrideX table or device configuration.
- **Keycloak handles identity:** sign-in, verified email, passwords and realm-scoped users. Each customer organisation has its own OpenRemote realm; the existing `gridex` realm is the pilot organisation, not a shared customer realm.
- **GrideX API is the protected application layer:** it checks tenant and Site permissions, exposes portal APIs, coordinates provisioning and keeps invitations, drafts, configuration revisions, bindings, delivery state and audit records in a separate GrideX PostgreSQL database. These records do not replace OpenRemote inventory.
- **Edge software owns physical communication and safety:** ROCK Pi collects data from local nodes such as ESP32 and publishes health/telemetry; device commands remain locked until approved commissioning and safety checks. Transport can be selected per Site: private MQTT through the Site router's WireGuard tunnel or direct MQTT over mutually authenticated TLS. The inventory, permissions and message contracts stay the same.

## Containers and services

The Compose files define a **core stack** and **optional integrations**. An overlay being present in this repository does not mean that it is enabled in every deployment.

| Compose service | Purpose |
| --- | --- |
| `postgresql` | OpenRemote database, including TimescaleDB measurement history. |
| `keycloak` | Identity, realm users and account-action emails; the Mailgun overlay adds the email provider. |
| `manager` | OpenRemote Assets, attributes, rules, Agents and authenticated Manager UI. |
| `proxy` | Local HTTPS entry point for OpenRemote and Keycloak. |
| `gridex-db` | Separate PostgreSQL for GrideX workflows, permissions/bindings and audit; not a second inventory. |
| `gridex-market-db` | Dedicated TimescaleDB for permanent hourly wholesale-price history; not customer inventory. |
| `gridex-api` | Portal-facing API, authorization and provisioning orchestration. |
| `gridex-market-worker` | Retrieves ENTSO-E A44 day-ahead prices with the private token and stores complete UTC hours. |
| `broker` | Mosquitto MQTT broker with client certificates and scoped topic access. |
| `heartbeat-worker` | Consumes gateway/node health messages and updates connection state. |
| `history-worker` | Consumes approved measurements and writes attributes/datapoints through OpenRemote. |
| `heartbeat-alert-worker` | Detects missing heartbeat and sends eligible, consented event email. |
| `public-proxy` | Restricted public HTTPS routing for portal API, authentication and approved Manager paths; MQTT uses a separate TLS/TCP ingress. |
| `portainer` | Optional container operations UI; it is not part of the product data model. |

Core services are defined in [`compose.mac.yml`](compose.mac.yml); MQTT, workers, email, public access and other optional services have separate `compose.*.yml` files. Persistent volumes hold the databases and service state. Certificates, credentials and the single operator backend environment file live outside Git.

## Provisioning and data flow

1. A platform administrator invites the first administrator of a new organisation. Its own OpenRemote realm, identity and permissions must be verified before the organisation becomes active. The recipient completes email verification and password setup; organisation administrators can then invite their authorised users.
2. An organisation administrator creates a Site and chooses supported GrideX devices and roles in the portal. The GrideX API validates rights and provisions the corresponding OpenRemote hierarchy. Configuration may remain a draft or pending until all bindings and device acknowledgements are verified; it must not appear as an active, local-only device.
3. ROCK Pi and its connected devices report heartbeat and selected measurements over the Site's authorised transport. Workers map those messages to the correct OpenRemote Assets. Measurement periods and fields are configured per device; a heartbeat is not itself a measurement.
4. The portal reads authorised live state and history. Cross-organisation access is denied, and hardware control remains subject to commissioning and edge safety gates.

For exact contracts and operating procedures, see [provisioning authority](docs/OPENREMOTE_PROVISIONING_AUTHORITY.md), [organisation invitations](docs/ORGANISATION_INVITATION_PLAN.md), [device history](docs/TIMESCALE_DEVICE_HISTORY.md), [per-Site transport](docs/PER_SITE_TRANSPORT_AND_ENROLLMENT.md), [API contract](docs/gridex-api-v1.md) and the [current handoff](HANDOFF.md). These documents, rather than this overview, track rollout status and detailed setup.

---

## Български

GrideX е платформа за управление на енергията на Обекти, оборудване и измерени данни. Това хранилище съдържа backend-а върху OpenRemote, GrideX API, обработващите услуги и описанието на внедряването. [Уеб порталът](https://github.com/antouanbg/gridex-energy-os) и [софтуерът за ROCK Pi/ESP32](https://github.com/antouanbg/gridex-edge-gateway) са в отделни хранилища. Проектът е с отворен код под MIT License; виж [приноса към проекта](CREDITS.md).

### Архитектура

- **OpenRemote е единственият основен регистър на работния инвентар:** realm-и на организациите, Обекти, шлюзове, устройства, сензори, атрибути и връзките им. Историческите измервания се пазят в неговата PostgreSQL/TimescaleDB. Ресурс не е провизиран само защото присъства в таблица на GrideX или в конфигурация на устройство.
- **Keycloak управлява самоличността:** вход, потвърден имейл, пароли и потребители по realm. Всяка клиентска организация има собствен OpenRemote realm; съществуващият `gridex` realm е за пилотната организация, не общ realm за клиентите.
- **GrideX API е защитеният приложен слой:** проверява права за организация и Обект, обслужва портала, координира провизирането и пази покани, чернови, ревизии на настройки, връзки, състояние на доставката и одит в отделна GrideX PostgreSQL база. Тези записи не заместват инвентара в OpenRemote.
- **Edge софтуерът отговаря за физическата комуникация и безопасността:** ROCK Pi събира данни от локални нодове като ESP32 и изпраща статус/телеметрия. Командите към оборудването остават заключени до одобрен commissioning и проверки за безопасност. За всеки Обект може да се избере частен MQTT през WireGuard тунела на рутера му или директен MQTT с двустранно TLS удостоверяване. Инвентарът, правата и договорите за съобщенията са еднакви.

### Контейнери и услуги

Compose файловете описват **основен стек** и **допълнителни интеграции**. Наличието на overlay в хранилището не означава, че е включен във всяко внедряване.

| Compose услуга | Роля |
| --- | --- |
| `postgresql` | База на OpenRemote, включително TimescaleDB за историята на измерванията. |
| `keycloak` | Самоличност, потребители по realm и имейли за действия по акаунта; Mailgun overlay добавя доставчика за писмата. |
| `manager` | OpenRemote Assets, атрибути, правила, Agents и защитен Manager интерфейс. |
| `proxy` | Локален HTTPS вход към OpenRemote и Keycloak. |
| `gridex-db` | Отделна PostgreSQL за процесите, правата/връзките и одита на GrideX; не втори регистър на устройствата. |
| `gridex-market-db` | Отделна TimescaleDB за постоянна история на часовите борсови цени; не е клиентски инвентар. |
| `gridex-api` | API за портала, проверки на права и координация на провизирането. |
| `gridex-market-worker` | Получава ENTSO-E A44 цени с частния токен и пази само пълни UTC часове. |
| `broker` | Mosquitto MQTT с клиентски сертификати и ограничен достъп по теми. |
| `heartbeat-worker` | Приема съобщения за състоянието на шлюза/нода и обновява връзката. |
| `history-worker` | Приема одобрените измервания и записва атрибути/история през OpenRemote. |
| `heartbeat-alert-worker` | Следи за липсващ heartbeat и изпраща имейл при право и включено потребителско съгласие. |
| `public-proxy` | Ограничено публично HTTPS маршрутизиране за API, вход и одобрени Manager пътища; MQTT има отделен TLS/TCP вход. |
| `portainer` | Незадължителен интерфейс за управление на контейнерите; не е част от продуктовия модел на данните. |

Основните услуги са в [`compose.mac.yml`](compose.mac.yml); MQTT, обработващите услуги, имейлът, публичният достъп и другите допълнения са в отделни `compose.*.yml` файлове. Постоянните volumes пазят базите и състоянието на услугите. Сертификатите, тайните и единният операторски `.env` на backend-а са извън Git.

### Провизиране и поток на данните

1. Глобалният администратор кани първия администратор на нова организация. Нейният собствен OpenRemote realm, самоличността и правата се проверяват преди активиране. Получателят потвърждава имейла си и задава парола; след това администраторът на организацията може да кани разрешените ѝ потребители.
2. Администратор на организация създава Обект и избира поддържани GrideX устройства и роли през портала. GrideX API проверява правата и провизира съответната йерархия в OpenRemote. Конфигурацията може да остане чернова или чакаща, докато всички връзки и потвърждения от устройствата бъдат проверени; локално устройство не се показва като активно.
3. ROCK Pi и свързаните с него устройства изпращат heartbeat и избрани измервания през разрешения транспорт на Обекта. Обработващите услуги ги свързват с правилните OpenRemote Assets. Периодът и полетата на измерване се настройват за всяко устройство; heartbeat не е измерване.
4. Порталът показва разрешените текущи стойности и история. Достъпът до чужда организация се отказва, а управлението на оборудването е ограничено от commissioning и защитите в Edge.

За точните договори и инструкции виж [основния регистър и провизирането](docs/OPENREMOTE_PROVISIONING_AUTHORITY.md), [поканите](docs/ORGANISATION_INVITATION_PLAN.md), [историята на измерванията](docs/TIMESCALE_DEVICE_HISTORY.md), [транспорта по Обект](docs/PER_SITE_TRANSPORT_AND_ENROLLMENT.md), [API договора](docs/gridex-api-v1.md) и [актуалния handoff](HANDOFF.md). Там, а не в този обзор, се проследяват статусът на внедряването и подробните настройки.
