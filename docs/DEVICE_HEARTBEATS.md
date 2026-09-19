# Device heartbeat delivery / Доставка на heartbeat

## English

Observation-only path: ESP32 → ROCK Pi polling → private mTLS MQTT → heartbeat
worker → PostgreSQL → authenticated Site administrator → Devices. No new public
listener, direct ESP access, battery commands or VPN activation.

- ROCK publishes `/health` periodically, independently of `pcsHeartbeatOk`.
  `receivedAt` is the backend receipt time. `observedAt` determines freshness.
- Node telemetry carries `lastSuccessfulContactAt` from the successful Modbus
  identity + telemetry read, not the publish time. Failed polls preserve it;
  never-seen nodes have null. Heartbeat counter is separate and may wrap/reset.
- Worker rejects retained messages, observations older than 120 seconds or
  more than 5 seconds ahead, unknown topic bindings and mismatched identities.
  Duplicate/out-of-order observations cannot advance receipt time. This is NOT
  the journal recovery/ack worker; no telemetry replay or control action occurs.
- State defaults: 30 seconds stale, 90 offline. A stale/unseen ROCK cannot make
  ESP appear online. Legacy node payloads without contact time remain unknown.
- `GET /api/v1/sites/:siteId/device-heartbeats` requires verified administrator
  membership for that Site, no-store; returns items keyed by inventory gateway ID.
  Only timestamps/status/counter are exposed, never addresses or credentials.

### Deployment checklist (NOT executed)

1. Depends on backend PR #26's inventory/admin changes; do not merge old health
   PR #6 blindly (different schema/migration). Activation PR work is separate.
2. Apply additive `007_device_heartbeats.sql` with the deployment migration
   procedure and backup. It is deliberately not appended to legacy auto-migrate.
3. In the ONE private backend `.env`, set `GRIDEX_HEARTBEAT_BINDINGS` to JSON:
   `[{"site":"topic-site","gateway":"topic-rock","siteId":"SITE_UUID","gatewayId":"ROCK_UUID","nodes":{"1":"ESP_UUID"}}]`.
   Use actual registered IDs privately, never infer slot mappings from ordering.
4. Broker certificate CN ACL must permit that ROCK identity to publish only its
   exact health and nodes topics. Reader identity is read-only for those topics.
   Mount a reader directory with ca.crt/client.crt/client.key; no CA private key.
   Validate container UID read permissions and TLS hostname, never disable TLS.
5. Combine `compose.heartbeats.yml` with backend Compose using the SAME env file.
   Attach only the worker to private MQTT and backend networks. API thresholds
   use `GRIDEX_HEARTBEAT_STALE_SECONDS` / `GRIDEX_HEARTBEAT_OFFLINE_SECONDS`.
6. Current broker binds loopback only. A verified narrowly scoped LAN test path
   is still required before physical ROCK can connect. Do not expose public 8883
   or activate WireGuard as a workaround. No network change made in this task.
7. Build/install the Edge heartbeat revision with libmosquitto enabled on ROCK;
   use its existing protected env for identity, certificates and publish intervals.
   Keep all write gates locked. SSH currently needs local interactive authority.
8. Verify real receipt, ESP last-contact, stop/start/reboot ageing, SQL ordering,
   cross-site denial and actual owner browser UI before deployment acceptance.
   No synthetic packet may be written to the owner's real device history.

Tests: 30 Node tests including HTTP admin/site denial; C++ and frontend tests
tracked in their repositories. SQL query test is mocked, not PostgreSQL runtime
acceptance. Physical delivery, migration and owner browser remain unverified.

## Български

Път само за наблюдение: ESP32 → ROCK Pi polling → частен mTLS MQTT → worker →
PostgreSQL → удостоверен администратор на Обекта → Устройства. Без публичен
listener, директен ESP достъп, команди към батерия или включване на VPN.

- ROCK изпраща `/health` периодично, независимо от `pcsHeartbeatOk`. `receivedAt`
  е времето на backend получаване, `observedAt` определя актуалността.
- `lastSuccessfulContactAt` е моментът на успешното Modbus identity + telemetry
  четене, не на изпращането. Неуспешните проби го запазват; без контакт е null.
  Heartbeat броячът е отделен и може да се превърти/нулира.
- Worker отказва retained, записи по-стари от 120 секунди или над 5 секунди в
  бъдещето, неизвестни bindings и несъвпадащи идентичности. Повторни/разместени
  записи не обновяват receivedAt. Това НЕ е journal recovery/ack worker.
- По подразбиране: остарял след 30 секунди, offline след 90. Непотвърден/стар
  ROCK не доказва online ESP. Стар payload без време за контакт остава unknown.
- API `/api/v1/sites/:siteId/device-heartbeats` допуска само verified admin на
  Обекта, no-store. Връща времена/статус/брояч по inventory ID, без тайни/адреси.

### Внедряване (НЕ е изпълнено)

1. Зависимост от backend PR #26; старият PR #6 е с различна схема/миграция и
   не се слива сляпо. Activation работата остава отделна.
2. Backup и изрична additive миграция 007; не е добавена към legacy auto-migrate.
3. Bindings JSON от EN примера се попълва с реалните ID само в ЕДИННИЯ частен
   backend `.env`. Slot съответствията не се извеждат от реда на устройствата.
4. Отделен certificate CN и точни publish ACL за ROCK; read-only reader само
   по разрешените topics. Mount ca.crt/client.crt/client.key без CA private key.
   Проверяват се UID права и TLS hostname; TLS проверките не се изключват.
5. Compose worker използва същия env и частните MQTT/backend мрежи. Праговете
   са GRIDEX_HEARTBEAT_STALE_SECONDS / GRIDEX_HEARTBEAT_OFFLINE_SECONDS.
6. Broker сега е само loopback; нужен е проверен ограничен LAN тестов път.
   Без public 8883, VPN workaround или извършена мрежова промяна в тази задача.
7. Native Edge build/install с libmosquitto на ROCK и неговия защитен env за
   identity/certs/интервали. Write gates остават заключени. SSH изисква локален вход.
8. Приемане след реален receipt, ESP контакт, ageing при stop/start/reboot,
   PostgreSQL ordering, cross-site отказ и реален owner browser. Без synthetic
   пакети в реалната история на устройствата.

Тестове: 30 Node теста включително HTTP admin/site отказ. C++/frontend тестовете
са в съответните repo. SQL е mock тест, не runtime PostgreSQL приемане. Реалната
доставка, миграцията и owner browser още не са проверени.
