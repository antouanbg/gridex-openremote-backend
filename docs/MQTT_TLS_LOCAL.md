# MQTT mutual TLS / MQTT с взаимно TLS удостоверяване

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## English

Implemented and locally tested 2026-09-15: Mosquitto 2.0.22 ARM64, digest pinned
in compose.mqtt.yml; separate gridex-mqtt stack visible in Portainer. Loopback
8883 only, no published plaintext 1883, no WebSocket listener, no public access.
TLS 1.2 minimum; server hostname verification and mandatory client certificate.
Certificate CN supplies the ACL username, not a client-supplied MQTT username.
Reference: [Mosquitto configuration](https://www.mosquitto.org/man/mosquitto-conf-5.html).

Runtime: private ~/GrideX-runtime/mqtt, outside Git and synced storage. CA private
key stays there and is NOT mounted into broker. Broker mounts only its key/cert,
public CA, minimal health client credentials, ACL/config and persistent data.
Non-root host UID/GID, read-only root filesystem, no capabilities, no-new-privileges.
Private directories 0700, generated key files 0600. 90-day leaf certificates;
generator preserves keys and verifies existing certificate chain. No automatic
renewal/revocation system yet. Protect/back up the CA separately; it is local,
not an offline/hardware-protected production CA.

Private sites.json contains validated identity/site/gateway segments. Defaults
lab-a and lab-b are SYNTHETIC, not deployed customer bindings. Edit only this
private inventory for real assignments, run generator and restart broker after
review. Every identity gets an independent key. Do not copy another site's key.
Never put real inventory/certificates into Git. No broad topic grant by default.

| Identity | Grant |
| --- | --- |
| Site identity | Write its exact gridex/v1/sites/{site}/edge/{gateway}/health |
| Same site | Write its exact .../nodes/+/telemetry |
| backend-reader | Read only those registered health/telemetry paths |
| broker-health | Read only $SYS/broker/uptime |

Sites have no read or command permissions. Backend reader cannot publish. No
journal ACK/recovery or command topic is enabled. Bindings match the current
Edge health and node telemetry publisher; they do not enable an ingestion worker.
Removing an identity from inventory and regenerating ACL/restarting broker removes
topic access and disconnects sessions; the CA-signed cert still passes TLS until
expiry (not cryptographic revocation). CRL/rotation acceptance is a future task.

Persistence: bind-mounted data directory, autosave and graceful restart; verified
with synthetic retained health payload, removed after test. QoS/session queues
bounded per client (100 messages / 1 MiB), packet max 64 KiB, application message
32 KiB, 100 connections, process memory cap and rotating Docker logs 3 × 10 MiB.
These are not a hard disk quota or retention policy for an unlimited session count;
disk monitoring/quota, load testing and production backup/restore remain required.

Reproduce locally (from repository):

```sh
python3 scripts/prepare-mqtt.py
docker-compose --context colima-gridex --project-directory "$HOME/GrideX-runtime/mqtt" -f "$HOME/GrideX-runtime/mqtt/compose.mqtt.yml" up -d
python3 scripts/test-mqtt.py
```

Test script restarts ONLY gridex-mqtt-broker-1. Real network MQTT v5 tests passed:
client certificate required; wrong server hostname rejected; own publish/reader
delivery; cross-site writes, commands and backend-reader writes rejected (135);
site cannot read foreign telemetry; reconnect and retained persistence after
restart. No certificate verification bypass. Initial CA omitted keyUsage, rejected
by Python's strict validator; generator now issues explicit CA constraints using
the existing key. Corrected full test passed.

Remaining: provision actual site/gateway identities and leaf files securely;
VPN-only listener access via Site Router (do NOT expose loopback on 0.0.0.0 as a
shortcut); verify ROCK Pi TLS settings, no WireGuard on ROCK Pi/ESP; deploy
authenticated/schema-validated ingestion to GrideX PostgreSQL and approved
OpenRemote mapping; commissioning tests, CA rotation/revocation and disk backup.
No actual device received credentials or had configuration changed by this task.
API/database containers were not restarted. Broker receipt is not DB ingestion.

## Български

Внедрено и тествано локално на 2026-09-15: Mosquitto 2.0.22 ARM64 с pinned digest
в compose.mqtt.yml; отделен gridex-mqtt stack в Portainer. Само loopback 8883,
без публикуван plaintext 1883, WebSocket или public достъп. Минимум TLS 1.2,
проверка на hostname и задължителен клиентски сертификат. CN на сертификата
определя ACL потребителя, не подаденото MQTT username. Референцията е горе.

Runtime: частен ~/GrideX-runtime/mqtt извън Git и синхронизацията. CA private key
НЕ се mount-ва в broker. Контейнерът получава само server key/cert, публичен CA,
ограничен health сертификат, ACL/config и data. Non-root UID/GID, read-only root,
без capabilities, no-new-privileges. Папки 0700, генерирани ключове 0600.
Leaf сертификати 90 дни; генераторът запазва ключовете и проверява веригата.
Няма автоматично подновяване/отмяна. CA се пази/архивира отделно; не е offline
или хардуерно защитен production CA.

Частният sites.json съдържа валидирани identity/site/gateway сегменти. lab-a и
lab-b са СИНТЕТИЧНИ, не реални клиенти. Реалните назначения се добавят само там,
следват генератор и прегледан restart. Всяка идентичност има независим ключ;
никога не се копира ключ от друг обект. Inventory/сертификати не влизат в Git.

| Идентичност | Право |
| --- | --- |
| Обект | Запис само gridex/v1/sites/{site}/edge/{gateway}/health |
| Същият обект | Запис само .../nodes/+/telemetry |
| backend-reader | Четене само на регистрираните health/telemetry paths |
| broker-health | Четене само $SYS/broker/uptime |

Обектите нямат четене/команди, reader няма запис. Няма journal ACK/recovery или
command topic. Paths съвпадат с Edge publisher, но не включват ingestion worker.
Изтриване от inventory, регенериране на ACL и restart отнемат topic достъпа и
прекъсват сесиите; сертификатът остава TLS валиден до expiry — това не е
криптографска отмяна. CRL/rotation приемането е оставаща задача.

Данни: постоянна bind папка, autosave и graceful restart; доказано с тестов
retained health payload, премахнат след тест. Опашки по клиент 100 съобщения /
1 MiB, пакет 64 KiB, payload 32 KiB, 100 връзки, memory cap и Docker log rotation
3 × 10 MiB. Това НЕ е твърда disk quota/retention при неограничен брой сесии;
нужни са disk monitoring/quota, load и production backup/restore тестове.

Локално възпроизвеждане: трите команди в EN секцията. Тестът рестартира само
gridex-mqtt-broker-1. Минаха реални MQTT v5 тестове: сертификат, грешен hostname,
собствен запис/получаване, отказ 135 за чужд обект/команди/reader запис, липса
на чужда телеметрия, reconnect и persistent retained след restart. Без TLS bypass.
Първият CA нямаше keyUsage и строгият Python валидатор го отказа; генераторът
вече добавя CA constraints със същия ключ. Пълният повторен тест мина.

Остава: реални идентификатори и безопасна доставка на leaf ключове; VPN-only
достъп през Site Router (без shortcut 0.0.0.0); ROCK Pi TLS настройки, без
WireGuard на ROCK Pi/ESP; удостоверен/schema-validated ingestion към GrideX
PostgreSQL и одобрен OpenRemote mapping; commissioning, CA lifecycle и disk backup.
Няма доставени credentials или променена конфигурация на хардуер. API/DB не са
рестартирани. Получаване от broker не означава запис в база.
