# GrideX OpenRemote backend

## English

Independent OpenRemote deployment and integration contract. The web interface and C++ Edge Gateway are maintained in separate repositories.

The project is open source under the MIT License.

### First integration: SunStorage Pro 261 / STE-261L

The reference protocol defines a Modbus TCP endpoint on port `3200`, unit ID `1`. OpenRemote does not write directly to vendor registers. The command path is:

```text
GrideX UI/API -> OpenRemote Strategy Asset -> GrideX Control Asset
             -> Modbus TCP Agent -> GrideX Edge normalized map
             -> Safety Envelope -> SunStorage Pro 261 driver
```

The forecast and market strategy may request power, but only the Edge Gateway can apply a PCS command after validating the BMS limits.

The Edge northbound endpoint is a Modbus TCP server on port `1502`, unit ID `1`, supporting FC03/04 reads and FC06/16 writes. OpenRemote refreshes the EMS heartbeat every 10 seconds; the Edge timeout is 15 seconds.

ROCK Pi E polls local endpoints and enforces the safety envelope. Dedicated nodes translate one configured device family. Backend traffic reaches the site through the site router WireGuard tunnel; ROCK Pi E and ESP32 do not run WireGuard, and public MQTT 8883 is not exposed.

### Contents

- `docker-compose.yml` — local OpenRemote stack based on the official container architecture.
- `deployment/manager/app/manager_config.json` — GrideX branding.
- `contracts/energy-asset.schema.json` — canonical model shared by UI, OpenRemote and Edge.
- `config/edge-register-map.yaml` — northbound Modbus TCP map of the Edge Gateway.
- `config/sunstorage-pro-261.yaml` — confirmed vendor registers used by the first driver.
- `config/ste261l-asset-blueprint.yaml` — Asset tree, attributes, Modbus links and command ownership.
- `config/mqtt-node-telemetry.yaml` — direct MQTTS contract, security and Edge fallback.
- `config/driver-reference-catalog.yaml` — confirmed mappings and external protocol references, with validation status.
- `contracts/power-command.schema.json` — desired-power and TTL API contract.
- `contracts/operator-command.schema.json` — protected start/stop, reactive-power and SOC-limit contract.
- `docs/integration-flow.md` — Asset tree, command flow and commissioning conditions.
- `docs/frontend-openremote-architecture.md` — GrideX Portal → GrideX API → OpenRemote boundary.
- `docs/gridex-api-v1.md` — complete frontend/backend API, database, Asset and hardware contract in English and Bulgarian.
- `docs/diagrams/` — communication-flow and normalised PostgreSQL ER diagrams.
- `services/gridex-api` — protected frontend adapter/BFF; OpenRemote remains the backend.

### Start locally

1. Copy `.env.example` to `.env` and replace the sample password.
2. Run `docker compose up -d`.
3. Open `https://localhost` and create a Modbus TCP Agent for the GrideX Edge IP address, port `1502`, unit ID `1`.
4. Link attributes according to `config/edge-register-map.yaml`.

GrideX API is published behind a TLS reverse proxy. Command writes are locked by default; `GRIDEX_WRITES_ENABLED=true` is set only after successful commissioning.

Production container versions must be pinned to exact tested tags. `latest` is retained only for the initial local prototype.

### Responsibility boundary

GrideX API owns browser authorization, tenancy, stable DTOs, configuration revisions and audit. OpenRemote owns live Assets, datapoints, rules and Agents. Edge owns device drivers, vendor addressing/sign/scaling, heartbeat, BMS envelope, software fuse and fail-safe behaviour.

---

## Български

Отделен deployment и интеграционен договор за OpenRemote. Уеб интерфейсът и C++ Edge Gateway не са част от този код.

Проектът е open source и се разпространява под MIT License.

## Първа интеграция: SunStorage Pro 261 / STE-261L

Референтният протокол описва Modbus TCP endpoint на порт `3200`, unit ID `1`. OpenRemote не пише директно към vendor регистрите. Командният път е:

```text
GrideX UI/API -> OpenRemote Strategy Asset -> GrideX Control Asset
             -> Modbus TCP Agent -> GrideX Edge normalized map
             -> Safety Envelope -> SunStorage Pro 261 driver
```

Така прогнозата и пазарната стратегия могат да поискат мощност, но само Edge Gateway може да приложи команда към PCS след валидиране на BMS лимитите.

Edge northbound endpoint вече е реализиран като Modbus TCP server на порт `1502`, unit ID `1`, с read функции FC03/04 и write функции FC06/16. OpenRemote обновява EMS heartbeat през 10 секунди; Edge timeout е 15 секунди.

ROCK Pi E обхожда локалните endpoints и прилага safety envelope. Отделните нодове
превеждат по една конфигурирана фамилия устройства. Backend трафикът минава през
WireGuard тунела на site router-а; ROCK Pi E и ESP32 нямат WireGuard, а публичен
MQTT 8883 не се публикува.

## Съдържание

- `docker-compose.yml` - локален OpenRemote stack по официалната контейнерна архитектура.
- `deployment/manager/app/manager_config.json` - GrideX branding.
- `contracts/energy-asset.schema.json` - каноничен модел между UI, OpenRemote и Edge.
- `config/edge-register-map.yaml` - northbound Modbus TCP карта на Edge Gateway.
- `config/sunstorage-pro-261.yaml` - потвърдените vendor регистри, използвани от първия драйвер.
- `config/ste261l-asset-blueprint.yaml` - asset tree, атрибути, Modbus връзки и ownership на командите.
- `config/mqtt-node-telemetry.yaml` - директният MQTTS договор, security и Edge fallback.
- `config/driver-reference-catalog.yaml` - потвърдени и референтни карти с ясен статус.
- `contracts/power-command.schema.json` - API договор за желаната мощност и TTL.
- `contracts/operator-command.schema.json` - защитен договор за start/stop, реактивна мощност и SOC граници.
- `docs/integration-flow.md` - asset tree, command flow и commissioning условия.
- `docs/frontend-openremote-architecture.md` - връзката GridEx Portal -> GridEx API -> OpenRemote.
- `docs/gridex-api-v1.md` - пълният API, база, Asset и hardware договор на английски и български.
- `docs/diagrams/` - схеми на комуникацията и нормализирания PostgreSQL модел.
- `services/gridex-api` - защитен frontend adapter/BFF; OpenRemote остава backend.

## Стартиране

1. Копирайте `.env.example` като `.env` и сменете паролата.
2. Стартирайте `docker compose up -d`.
3. Отворете `https://localhost` и създайте Modbus TCP Agent към IP адреса на GrideX Edge, порт `1502`, unit ID `1`.
4. Свържете атрибутите по `config/edge-register-map.yaml`.

GridEx API се публикува зад TLS reverse proxy. По подразбиране командните записи са заключени; `GRIDEX_WRITES_ENABLED=true` се задава едва след успешно commissioning.

За production контейнерните версии трябва да бъдат заключени до конкретен тестван tag. `latest` е оставен само за първоначалния локален прототип.

## Граница на отговорност

GrideX API държи browser authorization, tenancy, стабилните DTOs, ревизиите на конфигурациите и audit. OpenRemote държи live Assets, datapoints, rules и Agents. Edge държи device drivers, vendor адресиране/sign/scale, heartbeat, BMS envelope, software fuse и fail-safe.
