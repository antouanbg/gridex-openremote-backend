# Configuration field ownership / Собственост на конфигурационните полета

## English

The canonical, field-by-field matrix is
[`contracts/configuration-field-ownership.yaml`](../contracts/configuration-field-ownership.yaml).
It covers all ten configuration sections and records four decisions for every
editable or displayed field:

- whether PostgreSQL stores the durable user intent;
- the allow-listed OpenRemote Asset attribute, when an operational projection
  is required;
- whether Edge consumes the field as configuration, driver metadata or runtime
  state;
- whether the portal must render the value read-only.

The ownership rule is deliberately asymmetric. PostgreSQL stores revisioned
commercial and user configuration. OpenRemote receives only operational values
needed by Assets, rules and Agents. Edge receives only commissioning and safety
configuration needed close to the equipment. Live SOC, SOH, BMS limits,
telemetry, applied commands and deployment state remain read-only upstream
facts; a configuration revision cannot overwrite them.

### Runtime validation coverage

`services/gridex-api/src/configuration-centre.mjs` validates all sections before
simulation or activation:

| Section | Important enforced rules |
|---|---|
| `site` | required identity and coordinates; valid geographic ranges; market-participation fields |
| `pv` | unique arrays; orientation/mounting/tracking enums; geometry; tracker layout; east/west total; coordinate pairs |
| `battery_pcs` | type/coupling; capacity and PCS power; ordered SOC limits; efficiencies; lifecycle economics; all-in-one PCS identity |
| `metering_grid` | PCC/sign/CT/VT/phase; grid and fuse limits; fixed-fallback values; unique submeter roles |
| `market_tariffs` | EUR-only; unique typed tariff components; schedule delivery fields |
| `forecast` | exactly two distinct price models; 15-minute resolution; horizon, confidence, age and training bounds; ERP dependency |
| `strategy` | supported mode/fallback; control timing; loss-protection mode; economic floors for price strategies; low-solar reserve dependency |
| `loads_ev` | unique relations; priorities and ordered power limits; deadline/ERP/tariff dependencies |
| `edge_devices` | router-terminated VPN topology; one interface/device per gateway; supported interface types; no embedded secrets |
| `notifications_access` | recipients/channels/severity; approval-role separation; retention bounds |

The outbox projection is an explicit allow-list. Vendor addresses, register
sign/scaling, protocol credentials, heartbeat, BMS envelope, software fuse and
fail-safe logic are not moved into OpenRemote configuration attributes.

## Български

Каноничната матрица поле по поле е в
[`contracts/configuration-field-ownership.yaml`](../contracts/configuration-field-ownership.yaml).
Тя покрива всичките десет конфигурационни раздела и за всяко поле указва:

- дали PostgreSQL пази трайното намерение на потребителя;
- към кой разрешен OpenRemote Asset атрибут се проектира полето;
- дали Edge го използва като конфигурация, driver metadata или runtime state;
- дали порталът трябва да го показва само за четене.

PostgreSQL е каноничният източник за версионираната търговска и потребителска
конфигурация. OpenRemote получава само оперативните стойности, необходими на
Assets, rules и Agents. Edge получава само commissioning и safety настройките,
които трябва да са близо до оборудването. Live SOC, SOH, BMS лимити,
телеметрията, приложените команди и deployment статусът са само за четене и не
могат да бъдат презаписани от конфигурационна ревизия.

Runtime валидаторите покриват задължителните полета, допустимите диапазони и
условните зависимости за всичките десет раздела. Особено се проверяват двете
различни ценови прогнози, 15-минутната резолюция, EUR тарифите, двата режима на
защитата „не продавай на загуба“, разходните прагове, PV геометрията, SOC
границите, fallback поведението при липсващ електромер и правилото за един тип
устройство и един интерфейс на Edge шлюз.

Outbox проекцията е изричен allow-list. Vendor адресите, register sign/scaling,
protocol credentials, heartbeat, BMS безопасният диапазон, софтуерният
предпазител и fail-safe логиката остават отговорност на Edge и не се записват
като OpenRemote конфигурационни атрибути.
