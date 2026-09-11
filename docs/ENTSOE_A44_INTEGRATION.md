# ENTSO-E A44 day-ahead prices / ENTSO-E A44 цени ден напред

## English

`data-services` retrieves ENTSO-E Transparency Platform document type `A44`
(Price Document) for the bidding-zone EIC configured on an electricity-supplier
asset. The request uses `in_Domain` and `out_Domain` with the same zone EIC,
and UTC `periodStart` / `periodEnd` values. Parsed points are stored as
EUR/MWh in PostgreSQL (`dam_price`); the later asset sync converts only where
an OpenRemote attribute requires another unit.

The production endpoint is `https://web-api.tp.entsoe.eu/api`. The service
never prints a request URL because the ENTSO-E security token is a query
parameter in the upstream API.

### Secret placement

On the Windows 11 backend host, create a **non-versioned** file such as:

```text
<secure-host-directory>\\entsoe_security_token.txt
```

Place only the token text in that file. Set the ignored local `.env` value:

```dotenv
ENTSOE_SECURITY_TOKEN_FILE=<secure-host-directory>/entsoe_security_token.txt
```

Docker Compose mounts it only into `data-services` as
`/run/secrets/entsoe_security_token`. The application reads that file first.
`ENTSOE_TOKEN` exists only as a local-development fallback and must not be used
for a production deployment, committed to Git, added to OpenRemote Assets or
sent to a browser, ROCK Pi or ESP32.

### Fetch operation

The exact EIC is installation configuration, not source code. After the secret
and `DATA_DB_DSN` are configured, run inside the data-services container:

```bash
gridex-data market fetch-a44 --zone-eic <BIDDING_ZONE_EIC>
```

Optional `--period-start` and `--period-end` arguments use timezone-aware
ISO-8601 timestamps, for example `2026-09-12T00:00:00Z`. The default fetch
starts at the current UTC day and requests two days, suitable for obtaining the
available day-ahead horizon without assuming a market publication hour.

This implementation is deliberately limited to authenticated A44 import and
idempotent PostgreSQL storage. Asset discovery, scheduled refresh, OpenRemote
attribute synchronisation, IBEX-specific sources and the second price forecast
remain separate worker work.

## Български

`data-services` извлича ENTSO-E Transparency Platform документ `A44` (Price
Document) за EIC кода на bidding zone-а, зададен в electricity-supplier asset.
Заявката използва еднакъв EIC за `in_Domain` и `out_Domain` и UTC стойности за
`periodStart` / `periodEnd`. Данните се пазят в PostgreSQL (`dam_price`) в
EUR/MWh; последващата синхронизация преобразува единицата само ако конкретен
OpenRemote атрибут я изисква.

Production endpoint-ът е `https://web-api.tp.entsoe.eu/api`. Услугата не
изписва URL на заявката, защото ENTSO-E security token е query parameter към
външния API.

### Място за тайната

На Windows 11 backend машината се създава **файл извън Git**, например:

```text
<secure-host-directory>\\entsoe_security_token.txt
```

В него се поставя само token-ът. В игнорирания локален `.env` се задава:

```dotenv
ENTSOE_SECURITY_TOKEN_FILE=<secure-host-directory>/entsoe_security_token.txt
```

Docker Compose го монтира само в `data-services` като
`/run/secrets/entsoe_security_token`. Приложението първо чете този файл.
`ENTSOE_TOKEN` е само резервен вариант за локална разработка и не се използва
в production, не се качва в Git, не се поставя в OpenRemote Assets и не се
изпраща към browser, ROCK Pi или ESP32.

### Извличане

Точният EIC е настройка на обекта, а не код. След конфигуриране на тайната и
`DATA_DB_DSN` командата в data-services container е:

```bash
gridex-data market fetch-a44 --zone-eic <BIDDING_ZONE_EIC>
```

Незадължителните `--period-start` и `--period-end` приемат timezone-aware
ISO-8601 стойности, например `2026-09-12T00:00:00Z`. По подразбиране заявката
започва от текущия UTC ден и обхваща два дни.

Тази реализация е ограничена до удостоверен A44 import и идемпотентно
съхранение в PostgreSQL. Asset discovery, периодично изпълнение,
синхронизацията към OpenRemote, IBEX-специфични източници и втората ценова
прогноза остават отделна работа по worker-а.
