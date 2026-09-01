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

Meter/EVSE/inverter nodes have two telemetry paths. ROCK Pi E polls them continuously over RS485 and exposes node slots through the same Modbus endpoint. An ESP32 may also write directly to its own OpenRemote Asset over MQTTS 8883. Control never travels directly through the ESP32 cloud connection.

### Contents

- `docker-compose.yml` — local OpenRemote stack based on the official container architecture.
- `deployment/manager/app/manager_config.json` — GrideX branding.
- `contracts/energy-asset.schema.json` — canonical model shared by UI, OpenRemote and Edge.
- `config/edge-register-map.yaml` — northbound Modbus TCP map of the Edge Gateway.
- `config/sunstorage-pro-261.yaml` — confirmed vendor registers used by the first driver.
- `config/ste261l-asset-blueprint.yaml` — Asset tree, attributes, Modbus links and command ownership.
- `config/mqtt-node-telemetry.yaml` — direct MQTTS contract, security and Edge fallback.
- `contracts/power-command.schema.json` — desired-power and TTL API contract.
- `contracts/operator-command.schema.json` — protected start/stop, reactive-power and SOC-limit contract.
- `docs/integration-flow.md` — Asset tree, command flow and commissioning conditions.
- `docs/frontend-openremote-architecture.md` — GrideX Portal → GrideX API → OpenRemote boundary.
- `services/gridex-api` — protected frontend adapter/BFF; OpenRemote remains the backend.

### Start locally

1. Copy `.env.example` to `.env` and replace the sample password.
2. Run `docker compose up -d`.
3. Open `https://localhost` and create a Modbus TCP Agent for the GrideX Edge IP address, port `1502`, unit ID `1`.
4. Link attributes according to `config/edge-register-map.yaml`.

GrideX API is published behind a TLS reverse proxy as `api.gridex.tech`. Command writes are locked by default; `GRIDEX_WRITES_ENABLED=true` is set only after successful commissioning.

Production container versions must be pinned to exact tested tags. `latest` is retained only for the initial local prototype.

### Responsibility boundary

OpenRemote owns strategy, forecasts, schedules, history, alarms, roles and the client API. Edge owns device drivers, vendor addressing/sign/scaling, heartbeat, BMS envelope, software fuse and fail-safe behaviour.

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

Meter/EVSE/inverter нодовете имат двоен telemetry path: ROCK Pi E ги polling-ва
постоянно по RS485 и ги предоставя в node slots на същия Modbus endpoint, а
ESP32 може паралелно да пише директно в собствения си OpenRemote Asset по MQTTS
8883. Управлението никога не минава директно през ESP32 облачната връзка.

## Съдържание

- `docker-compose.yml` - локален OpenRemote stack по официалната контейнерна архитектура.
- `deployment/manager/app/manager_config.json` - GrideX branding.
- `contracts/energy-asset.schema.json` - каноничен модел между UI, OpenRemote и Edge.
- `config/edge-register-map.yaml` - northbound Modbus TCP карта на Edge Gateway.
- `config/sunstorage-pro-261.yaml` - потвърдените vendor регистри, използвани от първия драйвер.
- `config/ste261l-asset-blueprint.yaml` - asset tree, атрибути, Modbus връзки и ownership на командите.
- `config/mqtt-node-telemetry.yaml` - директният MQTTS договор, security и Edge fallback.
- `contracts/power-command.schema.json` - API договор за желаната мощност и TTL.
- `contracts/operator-command.schema.json` - защитен договор за start/stop, реактивна мощност и SOC граници.
- `docs/integration-flow.md` - asset tree, command flow и commissioning условия.
- `docs/frontend-openremote-architecture.md` - връзката GridEx Portal -> GridEx API -> OpenRemote.
- `services/gridex-api` - защитен frontend adapter/BFF; OpenRemote остава backend.

## Стартиране

1. Копирайте `.env.example` като `.env` и сменете паролата.
2. Стартирайте `docker compose up -d`.
3. Отворете `https://localhost` и създайте Modbus TCP Agent към IP адреса на GrideX Edge, порт `1502`, unit ID `1`.
4. Свържете атрибутите по `config/edge-register-map.yaml`.

GridEx API се публикува зад TLS reverse proxy като `api.gridex.tech`. По подразбиране командните записи са заключени; `GRIDEX_WRITES_ENABLED=true` се задава едва след успешно commissioning.

За production контейнерните версии трябва да бъдат заключени до конкретен тестван tag. `latest` е оставен само за първоначалния локален прототип.

## Граница на отговорност

OpenRemote държи стратегията, прогнозите, графиците, историята, алармите, ролите и API за клиентските приложения. Edge държи device drivers, vendor адресиране/sign/scale, heartbeat, BMS envelope, software fuse и fail-safe.
