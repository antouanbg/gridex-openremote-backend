# GrideX OpenRemote backend

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
