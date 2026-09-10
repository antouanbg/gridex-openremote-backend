# Configuration outbox worker / Worker за конфигурационния outbox

## English

The worker is a separate process using the same `gridex-api` image. Start it
only after commissioning with:

```text
docker compose --profile configuration-worker up -d
```

It does not expose an HTTP port and it does not process field commands. Its only
job is to project an approved PostgreSQL configuration revision to allow-listed
OpenRemote configuration attributes.

### Processing guarantees

1. Claims one eligible row with `FOR UPDATE SKIP LOCKED` and a recovery lease.
2. Preserves revision order for each site and configuration section.
3. Resolves target Assets from trusted database bindings, never from a browser
   payload.
4. Maps only allow-listed fields. Command, heartbeat, telemetry, BMS-limit and
   operator-action attributes are explicitly protected.
5. Writes configuration attributes through the OpenRemote confidential client.
6. Reads each Asset back and verifies `gridexConfigurationRevision`.
7. Atomically marks the outbox row and configuration revision as applied.
8. Retries transient failures with bounded exponential delay. After the maximum
   attempts, the row becomes `dead_letter` and the configuration stays failed.

Partial OpenRemote writes are safe to retry because every write is idempotent
and carries the same revision. A later revision cannot overtake an earlier
pending/processing revision for the same site and section.

### Ownership boundary

- GrideX API/PostgreSQL owns authorization, tenancy, stable DTOs, configuration
  revisions, approval and audit.
- OpenRemote owns live Assets, datapoints, rules and Agents.
- Edge owns drivers, register address/sign/scale, heartbeat, BMS envelope,
  software fuse and fail-safe behaviour.

The worker never writes `requestedPowerKw`, command sequence, PCS start/stop,
reactive power, requested SOC limits, heartbeat, measured SOC/SOH, actual power
or BMS maximum charge/discharge limits.

### Operational settings

- `GRIDEX_CONFIG_WORKER_POLL_MS` — idle polling interval.
- `GRIDEX_CONFIG_WORKER_LEASE_SECONDS` — recovery lease for a claimed event.
- `GRIDEX_CONFIG_WORKER_MAX_ATTEMPTS` — transition to dead-letter threshold.

Secrets remain environment variables and are not included in queue payloads or
logs. Production should alert on `dead_letter`, growing queue age and repeated
OpenRemote authentication failures.

## Български

Worker-ът е отделен процес със същия container image като `gridex-api`. Той няма
HTTP порт и не изпълнява команди към физически устройства. Единствената му роля
е да преобразува одобрена PostgreSQL ревизия в предварително разрешени
конфигурационни OpenRemote атрибути.

Събитието се заключва с lease, редът на ревизиите за един обект и раздел се
запазва, а Asset ID се взема само от доверената таблица с bindings. След запис
Asset-ът се прочита обратно и се проверява `gridexConfigurationRevision`.
Временните грешки се повтарят с увеличаващ се интервал; след максималния брой
опити събитието става `dead_letter` и конфигурацията не се маркира като
приложена.

Worker-ът никога не записва команда за мощност, sequence, start/stop, реактивна
мощност, SOC команда, heartbeat, телеметрия или BMS лимити. Тези отговорности
остават съответно в OpenRemote rules/Agents и Edge safety слоя.

Docker профилът `configuration-worker` трябва да се включи едва след
commissioning. Тайните остават в environment/secret store и не попадат в
outbox payload или логовете.
