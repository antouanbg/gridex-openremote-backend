# GrideX BG visualisations and protected embedding

The optional `compose.grafana.yml` overlay has **no published port**. The BG
dashboard is embedded only behind `api.gridex.tech/grafana/`: a verified portal
identity obtains a one-time ticket, the API sets a host-only short-lived cookie,
and Nginx rechecks it for every Grafana page, asset and query. Anonymous and
forged cookies are denied. Customer access requires both `day_ahead` and
`visualisations` grants plus BG zone permission; the platform administrator
uses a separate verified allowlist. No standalone public Grafana login exists.
The dashboard displays Bulgarian ENTSO-E native 15-minute day-ahead intervals
where archived; older hourly history remains hourly. The last successful full
day import is distinct from the worker's last hourly provider check. Neither
OpenRemote nor customer telemetry is connected to this data source.

The reviewed Grafana OSS ARM64 image is pinned in the Compose overlay. Set
`GRIDEX_GRAFANA_ADMIN_PASSWORD` and
`GRIDEX_GRAFANA_MARKET_READER_PASSWORD` in the **single private backend env**.
`market-reader-role.sql` prepares a NOLOGIN role with SELECT only on
BG-filtered views, not the underlying market tables. At activation, give it a
unique private password and LOGIN; never reuse the market owner password.
Test denial of direct table reads and writes, datasource health, anonymous
proxy denial and a real authorised browser dashboard before declaring the
end-to-end path complete. The service-request UI is a separate pending task.

For future telemetry, provision separate read-only data sources and narrow
database roles for GrideX Timescale measurement history and OpenRemote's
authoritative assets. Dashboard queries must be tenant-scoped before any
customer embedding. OSS Grafana has light/dark themes but not full custom
branding; the GrideX portal should own the approved visual shell, while
charts use its dark green/lime palette. Any future customer telemetry source
needs its own tenant-filtered read-only role and security review; the BG
market role must not be expanded.
