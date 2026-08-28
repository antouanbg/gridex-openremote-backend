# GrideX OpenRemote backend

Отделен deployment и интеграционен договор за OpenRemote. Уеб интерфейсът и C++ Edge Gateway не са част от този код.

## Първа интеграция: SunStorage Pro 261 / STE-261L

Референтният протокол описва Modbus TCP endpoint на порт `3200`, unit ID `1`. OpenRemote не пише директно към vendor регистрите. Командният път е:

```text
GrideX UI/API -> OpenRemote Strategy Asset -> GrideX Control Asset
             -> Modbus TCP Agent -> GrideX Edge normalized map
             -> Safety Envelope -> SunStorage Pro 261 driver
```

Така прогнозата и пазарната стратегия могат да поискат мощност, но само Edge Gateway може да приложи команда към PCS след валидиране на BMS лимитите.

## Съдържание

- `docker-compose.yml` - локален OpenRemote stack по официалната контейнерна архитектура.
- `deployment/manager/app/manager_config.json` - GrideX branding.
- `contracts/energy-asset.schema.json` - каноничен модел между UI, OpenRemote и Edge.
- `config/edge-register-map.yaml` - northbound Modbus TCP карта на Edge Gateway.
- `config/sunstorage-pro-261.yaml` - потвърдените vendor регистри, използвани от първия драйвер.
- `docs/integration-flow.md` - asset tree, command flow и commissioning условия.

## Стартиране

1. Копирайте `.env.example` като `.env` и сменете паролата.
2. Стартирайте `docker compose up -d`.
3. Отворете `https://localhost` и създайте Modbus TCP Agent към IP адреса на GrideX Edge, порт `1502`, unit ID `1`.
4. Свържете атрибутите по `config/edge-register-map.yaml`.

За production контейнерните версии трябва да бъдат заключени до конкретен тестван tag. `latest` е оставен само за първоначалния локален прототип.

## Граница на отговорност

OpenRemote държи стратегията, прогнозите, графиците, историята, алармите, ролите и API за клиентските приложения. Edge държи device drivers, vendor адресиране/sign/scale, heartbeat, BMS envelope, software fuse и fail-safe.
