# OpenRemote and Edge integration flow

## English

### Asset tree

```text
Organisation
└── Site
    ├── PCC meter
    ├── PV inverter(s)
    ├── battery / all-in-one cabinet
    ├── EVSE and flexible loads
    ├── GrideX Strategy
    └── GrideX Control
```

The strategy layer writes desired operating configuration. The protected OpenRemote rule writes one complete Control command. ROCK Pi E validates freshness, PCS state, BMS limits, SOC, software-fuse margin and command sequence before the device driver can apply power.

For SunStorage Pro 261, the confirmed vendor semantics are: Modbus TCP port 3200, unit ID 1, no address offset, positive discharge / negative charge, command scale ×10, Int32 ABCD high-order word first, FC06 commands at intervals of at least one second, and heartbeat enable 5302 followed by countdown 5301. Registers 122–125 are read atomically in one FC04 request. Counters 122/124 are BMS DC-side energy retained across power loss; daily counters 129/130 reset at local BMS midnight.

Cloud command writes stay locked until communication, polarity, scale, BMS limits, SOC, PCC meter, heartbeat, PCS mode and faults pass commissioning. Edge remains authoritative for fail-safe behaviour.

### Network path

OpenRemote reaches the site only through the site router WireGuard tunnel. ROCK Pi E and ESP32 do not run WireGuard. CONTROL and TELEMETRY networks are separated; OT/BESS is not directly routed to the backend; site-to-site routing is forbidden. Public MQTT 8883 is not exposed after the VPN-only migration.

### Node roles

ROCK Pi E polls each OLIMEX ESP32-EVB canonical map over isolated OT Ethernet
and maintains the local safety envelope. A node translates exactly one
configured CAN or RS485 device family. Telemetry goes directly from the node
to VPN-only MQTT through the site router; commands always return through
OpenRemote, ROCK Pi E and the node's local Modbus TCP endpoint.

## Български

Стратегията задава желаната конфигурация, защитено OpenRemote правило създава една цяла Control команда, а ROCK Pi E проверява freshness, PCS състояние, BMS лимити, SOC, software-fuse резерв и command sequence. Едва след това конкретният драйвер може да подаде мощност към устройството.

За SunStorage Pro 261 са потвърдени: Modbus TCP порт 3200, unit ID 1, без address offset, положителна стойност за разряд и отрицателна за заряд, мащаб ×10, Int32 ABCD с high-order word first, FC06 през минимум една секунда и heartbeat чрез 5302/5301. Регистри 122–125 се четат атомарно с една FC04 заявка. Натрупаната енергия е от BMS DC страната и се пази при отпадане на захранването; дневните броячи се нулират в локалното BMS полунощ.

Командите остават заключени до успешна проверка на комуникацията, знак, мащаб, BMS лимити, SOC, PCC meter, heartbeat, PCS режим и faults. Edge остава последната инстанция за безопасност.

OpenRemote достига обекта само през WireGuard тунела на site router-а. ROCK Pi E и ESP32 нямат WireGuard. CONTROL и TELEMETRY са отделени, OT/BESS не се route-ва директно към backend, няма site-to-site routing и публичен MQTT 8883 не се използва след VPN-only миграцията.
