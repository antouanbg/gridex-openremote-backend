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
2. Потвърдено е директното адресиране без +1/-1 offset.
3. Знакът заряд/разряд е потвърден с малка тестова мощност.
4. Мащабът и byte order са потвърдени.
5. BMS регистри 127/128 дават валидни динамични лимити.
6. Software fuse има валидно PCC измерване и договорен лимит.
7. Локалният PCS heartbeat е активен и наблюдаван.
8. PCS е включен (`5003=1`), grid-tied (`5001=0`) и в current-source/PQ режим (`5002=1`).
9. PCS/BMS fault и communication fault флаговете са чисти.

## OpenRemote agent links

Създава се Modbus TCP Agent към Edge Gateway, не към SunStorage. Атрибутите използват `INPUT` или `HOLDING` според `edge-register-map.yaml`, unit ID `1` и request interval минимум 1000 ms. Историята се включва за мощност, SOC, SOH, лимити, quality и приложена команда. Прогнозните редове се пазят като predicted datapoints в Strategy asset.

## API към клиентския интерфейс

GrideX UI използва OpenRemote HTTPS REST API за текущите asset стойности и WebSocket/event stream за live телеметрия. UI няма credentials или route към vendor PCS. Всички write операции са role-based и се записват в command history.

## Стратегия и пазарна логика

OpenRemote държи бизнес логиката над защитния слой: IBEX day-ahead цени, 15-минутни графици и небаланс, тридневна метеорологична/PV прогноза, товарова прогноза и заявки от ERP. Оптимизаторът може да задържи целеви SOC за следващ ден с ниско слънцегреене, да зареди от мрежата под зададен ценови праг и да блокира продажба при отрицателна цена. Edge Gateway остава единственият компонент, който превежда желаната мощност към регистър 5005 и винаги прилага BMS лимитите и локалните защити.
