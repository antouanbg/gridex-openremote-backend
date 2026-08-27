# OpenRemote integration flow

## Asset tree

```text
Organisation
└── Site
    ├── Grid connection / PCC meter
    ├── PV plant
    ├── SunStorage Pro 261
    │   ├── PCS
    │   ├── BAU/BMS
    │   ├── Thermal management
    │   └── Safety I/O
    ├── Flexible loads
    ├── GrideX Strategy
    └── GrideX Control
```

`GrideX Strategy.requestedPowerKw` е желаната стойност от арбитража, day-ahead графика или ръчния оператор. `GrideX Control.appliedPowerKw` е стойността след Edge safety envelope.

## Commissioning gate

Командите са забранени, докато едновременно не са изпълнени:

1. Vendor комуникацията е стабилна.
2. Регистровият offset е потвърден на реалната машина.
3. Знакът заряд/разряд е потвърден с малка тестова мощност.
4. Мащабът и byte order са потвърдени.
5. BMS регистри 127/128 дават валидни динамични лимити.
6. Software fuse има валидно PCC измерване и договорен лимит.
7. Локалният PCS heartbeat е активен и наблюдаван.

## OpenRemote agent links

Създава се Modbus TCP Agent към Edge Gateway, не към SunStorage. Атрибутите използват `INPUT` или `HOLDING` според `edge-register-map.yaml`, unit ID `1` и request interval минимум 1000 ms. Историята се включва за мощност, SOC, SOH, лимити, quality и приложена команда. Прогнозните редове се пазят като predicted datapoints в Strategy asset.

## API към клиентския интерфейс

GrideX UI използва OpenRemote HTTPS REST API за текущите asset стойности и WebSocket/event stream за live телеметрия. UI няма credentials или route към vendor PCS. Всички write операции са role-based и се записват в command history.
