# Edge health pipeline / Поток за Edge health

## English

`ROCK Pi health service → MQTT → Site Router VPN → GrideX ingestion → PostgreSQL + OpenRemote Site Asset → /snapshot → frontend`

The ROCK Pi publishes a small, non-secret health envelope every ten seconds to
`gridex/v1/sites/<site-code>/edge/<gateway-id>/health`. It is not a WireGuard
peer: its only path to the private MQTT listener is via its Site Router. No
OT/BESS network is routed to the backend and no public MQTT listener is used.

`gridex-edge-health-worker` validates the topic and payload, resolves the site
code, stores the latest record in `edge_gateway_health`, then projects the
operational values to the site's OpenRemote Asset. The browser never reads
OpenRemote or MQTT directly. The GrideX API recalculates stale/offline status
when it serves `GET /api/v1/sites/{siteId}/snapshot`.

The frontend renders one of: Demo mode, No health data, Online, Degraded,
Offline, or Safe mode. It must never show a fabricated online timestamp.

## Български

`ROCK Pi health услуга → MQTT → VPN през Site Router → GrideX ingestion → PostgreSQL + OpenRemote Site Asset → /snapshot → frontend`

ROCK Pi публикува малък несекретен health пакет на всеки десет секунди към
`gridex/v1/sites/<site-code>/edge/<gateway-id>/health`. Той не е WireGuard
peer: единственият му път към частния MQTT listener е през Site Router. OT/BESS
мрежата не се маршрутизира към backend-а и не се използва публичен MQTT listener.

`gridex-edge-health-worker` проверява topic-а и payload-а, намира site кода,
записва последния статус в `edge_gateway_health`, след което проектира
оперативните стойности в OpenRemote Asset на обекта. Браузърът не чете директно
нито OpenRemote, нито MQTT. GrideX API преизчислява stale/offline статуса при
`GET /api/v1/sites/{siteId}/snapshot`.

Frontend-ът показва: Демо режим, Няма health данни, Онлайн, Влошен, Офлайн или
Безопасен режим. Не показва измислен timestamp за онлайн статус.
