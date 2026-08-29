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

Началният asset tree и точните връзки към normalized Edge картата са описани в `config/ste261l-asset-blueprint.yaml`. Това е source-of-truth за бъдещия OpenRemote setup extension; deployment-specific IDs и IP адресът на Edge се задават при инсталацията.

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
10. Ако са зададени операторски PCS caps, те са неотрицателни и не могат да увеличат BMS лимитите.

## OpenRemote agent links

Създава се Modbus TCP Agent към Edge Gateway, не към SunStorage. Атрибутите използват `INPUT` или `HOLDING` според `edge-register-map.yaml`, unit ID `1` и request interval минимум 1000 ms. Историята се включва за мощност, SOC, SOH, лимити, quality и приложена команда. Прогнозните редове се пазят като predicted datapoints в Strategy asset.

Разширената батерийна телеметрия включва PCS status, DC/реактивна мощност,
текущ PCS setpoint, честота, обща и дневна енергия за заряд/разряд, SOC граници
и обобщени alarm bits. Регистри 122/124 са Int32, но производителската таблица
не определя word order; стойностите не се маркират като валидни, докато редът
на двете думи не бъде потвърден при commissioning.

## Защитени операторски действия

Start/stop (`5003`), реактивна мощност (`5006`) и SOC граници (`5007/5008`)
не са достъпни за автоматичната ценова стратегия. OpenRemote проверява роля
`operator` или `admin`, записва action mask и стойностите, след това apply key
`0xA55A` и накрая увеличава отделния operator sequence. Edge изпълнява всяка
sequence стойност само веднъж и връща result code.

При stop Edge първо задава `5005=0`, след което `5003=0`. Start се отказва,
ако телеметрията не е валидна, има fault или PCS не е в grid-tied/PQ режим.
SOC диапазонът трябва да изпълнява `0 <= lower < upper <= 100`; драйверът
първо разширява безопасния прозорец и после го стеснява, за да не се получи
невалидна междинна комбинация при два отделни Modbus записа.

## Meter, EVSE и inverter нодове

ROCK Pi E обхожда всички конфигурирани MBUS адреси непрекъснато по RS485.
Нормализираното копие на всеки нод се намира в отделен input-register слот от
`0x0100`, със stride 16 и максимум 32 нода. Това копие се използва от локалните
защити и като резервен облачен източник.

Когато нодът има интернет, LilyGo T-CAN485 публикува същата телеметрия директно
към OpenRemote Manager по MQTTS 8883. Директните атрибути и Edge копието не
трябва да пишат в един и същи атрибут. MQTT обновява `actualPowerKw`, а Modbus
Agent обновява `edgeActualPowerKw`; правило за freshness избира ефективната
стойност. Така няма надписване и системата продължава при отпадане на единия
път. Точният договор е в `config/mqtt-node-telemetry.yaml`.

MQTT връзката на ESP32 е само за телеметрия. Командите остават по пътя
OpenRemote -> Edge Modbus TCP -> safety envelope -> конкретен драйвер.

## API към клиентския интерфейс

GrideX UI не се свързва директно към OpenRemote. Браузърът използва GridEx API/BFF по HTTPS, а адаптерът преобразува OpenRemote Assets и Attributes към стабилния GridEx frontend договор. За live телеметрия GridEx API държи OpenRemote WebSocket subscription и предоставя един филтриран поток към портала. UI няма service-user secret, MQTT credentials или route към vendor PCS. Всички write операции са role-based и се записват в command history.

Пълната граница, endpoint-ите, runtime режимите и deployment hostnames са описани в `docs/frontend-openremote-architecture.md`.

## Стратегия и пазарна логика

OpenRemote държи бизнес логиката над защитния слой: IBEX day-ahead цени, 15-минутни графици и небаланс, тридневна метеорологична/PV прогноза, товарова прогноза и заявки от ERP. Оптимизаторът може да задържи целеви SOC за следващ ден с ниско слънцегреене, да зареди от мрежата под зададен ценови праг и да блокира продажба при отрицателна цена. Edge Gateway остава единственият компонент, който превежда желаната мощност към регистър 5005 и винаги прилага BMS лимитите и локалните защити.
