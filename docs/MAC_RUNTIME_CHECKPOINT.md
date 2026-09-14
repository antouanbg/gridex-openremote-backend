# Mac runtime checkpoint — 2026-09-14

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## English

This deployment checkpoint supersedes the not-yet-installed status in the earlier
Mac/Linux research handoff. It is not production acceptance.

- Installed Colima 0.10.3, Lima 2.2.0, Docker CLI 29.8.0, Compose 5.5.1,
  Buildx 0.37.1. Profile `gridex`: ARM64/vz, 8 CPUs, 16 GiB RAM, 150 GiB disk.
- Guest Ubuntu 24.04.4; Docker Engine 29.5.2; context `colima-gridex`.
- All six containers healthy: GrideX API, GrideX PostgreSQL, OpenRemote
  PostgreSQL, Keycloak, Manager and proxy. API `/health` reports ready,
  OpenRemote online, writes disabled. Authentication is NOT yet accepted.
- Built native API; 12 API tests passed. Applied migrations 001 and 002
  explicitly to the fresh GrideX database with stop-on-error; both committed.
- Runtime source and generated operator-only secrets are outside synced storage
  in `~/GrideX-runtime/backend`. Do not print or commit its `.env`.
- `compose.mac.yml` is standalone, project `gridex-mac`, not a base override.
  Only proxy and API join the ingress network. Other services use the internal
  backend network. Proxy publishes loopback 80/443, API loopback 8081. No database
  or MQTT host ports. Internal-only networking initially prevented port
  forwarding; adding ingress to these two services restored host API access.

### Pending, in order

1. Provision and test the gridex OIDC realm, portal and service client, roles,
   tenant checks, login/logout and unauthorized requests. Generated service
   credentials alone do not create a Keycloak client.
2. Verify TLS, restart persistence and isolated backup/restore. No production
   security or load certification yet.
3. Prepare backend WireGuard configuration, then commission a Site Router peer.
   The owner confirms no peer/router exists yet. No tunnel is established;
   direct local SSH checks are not VPN evidence. Do not install WG on Edge.
4. Review and integrate additional worker PRs separately; recovery, market-data,
   outbox and private ingestion are not implied by six healthy containers.

### Cross-repository Edge findings (read-only)

Target repository: `antouanbg/gridex-edge-gateway`.
ROCK Pi SSH works. `gridex-rockpie.service` and `gridex-ot-dhcp.service` are active;
the former reports zero restarts and commissioning locked. ESP is reachable in
the OT neighbor table and accepts TCP on 1502, but a unit-1 FC03 read of register
0 timed out after three seconds. TCP reachability does not prove Modbus health.

Repeated `telemetry journal snapshot write failed`: service user/group is
`gridex`; the journal is root-owned mode 0640 and its parent root-owned 0755.
These permissions prevent service writes; 55 GiB is free, so disk exhaustion
is not the observed cause. Edge follow-up must inspect the configured journal
path and systemd write restrictions before narrowly correcting ownership. No
permissions, firmware, services or physical control were changed in this check.
Next Edge action: fix journal deployment ownership, then diagnose ESP Modbus
handling using the actual firmware register contract. Do not reset or flash as
a substitute for diagnosis. Addresses/MACs are intentionally omitted.

## Български

Тази проверка заменя статуса „още не е инсталирано“ от първоначалното Mac/Linux
проучване. Не представлява production приемане.

- Инсталирани: Colima 0.10.3, Lima 2.2.0, Docker CLI 29.8.0, Compose 5.5.1,
  Buildx 0.37.1. Профил `gridex`: ARM64/vz, 8 CPU, 16 GiB RAM, 150 GiB диск.
- Guest Ubuntu 24.04.4; Docker Engine 29.5.2; context `colima-gridex`.
- Шест healthy контейнера: GrideX API, двете PostgreSQL бази, Keycloak,
  Manager и proxy. `/health`: ready, OpenRemote online, записите забранени.
  Автентикацията още НЕ е приета като работеща.
- Native API build; 12 успешни API теста. Миграции 001 и 002 са изпълнени
  изрично върху новата GrideX база със stop-on-error; двете са commit-нати.
- Runtime кодът и secrets само за оператора са извън синхронизираната папка,
  в `~/GrideX-runtime/backend`. Неговият `.env` не се печата или commit-ва.
- `compose.mac.yml` е самостоятелен, проект `gridex-mac`. Само proxy и API
  имат ingress мрежа; другите услуги са във вътрешната backend мрежа. Proxy
  публикува loopback 80/443, API — 8081; няма публикувани DB/MQTT портове.
  Само вътрешната мрежа първоначално блокира port forwarding; ingress към тези
  две услуги възстанови достъпа от host до API.

### Остава по ред

1. Създаване/тест на OIDC realm gridex, portal/service клиенти, роли, tenancy,
   вход/изход и неоторизирани заявки. Генерираният secret не създава клиент.
2. TLS, устойчивост след рестарт и отделен backup/restore тест. Няма production
   security или load сертификация.
3. Backend WireGuard конфигурация, после Site Router peer. Собственикът
   потвърди, че такъв още няма. Тунел не е установен; локалният SSH тест не е
   VPN доказателство. Не се инсталира WG върху Edge.
4. Отделен review/integration на worker PR-ите; шест healthy контейнера не
   означават готови recovery, market-data, outbox и private ingestion.

### Edge констатации за друго repository — само четене

Целево repository: `antouanbg/gridex-edge-gateway`.
SSH до ROCK Pi работи. `gridex-rockpie.service` и `gridex-ot-dhcp.service` са
active; първата е с нула рестарти и commissioning locked. ESP е reachable в
OT neighbor таблицата и приема TCP на 1502, но FC03 към unit 1, регистър 0
изтича след 3 секунди. TCP достъпът не доказва работещ Modbus.

Повтаря се `telemetry journal snapshot write failed`: услугата работи като
`gridex`, журналът е root-owned 0640, родителската папка — root-owned 0755.
Тези права забраняват записа; има 55 GiB свободни, т.е. не е установено
препълване. Следва Edge проверка на действителния journal path и systemd
write ограниченията преди корекция само на необходимите права. Тук не са
променяни права, firmware, услуги или управление на устройства. Следва:
корекция на ownership при deployment, после диагностика на ESP Modbus спрямо
реалния firmware договор. Без reset/flash вместо диагностика. IP/MAC са скрити.
