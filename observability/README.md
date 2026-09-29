# GrideX operator visualisations (prepared, not publicly enabled)

Grafana OSS is an **optional private operator tool**, not a new public menu or
tenant-facing login. The separate `compose.grafana.yml` overlay binds only to
`127.0.0.1`, disables anonymous access and embedding, and is not included in
the production Compose command. Do not put it behind `auth.gridex.tech` or
expose port 3300 to the Internet. The included dashboard displays only the
Bulgarian ENTSO-E hourly series and fetch timestamp. Its queries are fixed to
`country='BG' AND zone='BG'`; other customer and OpenRemote data are not wired.

Before activation, pin `GRIDEX_GRAFANA_IMAGE` to a reviewed Grafana OSS digest
and set `GRIDEX_GRAFANA_ADMIN_PASSWORD` and
`GRIDEX_GRAFANA_MARKET_READER_PASSWORD` in the **single private backend env**.
`market-reader-role.sql` prepares a NOLOGIN SELECT-only role on the three
market tables. At activation, give it a unique private password and LOGIN;
never reuse the market owner password. Test
read-only denial of INSERT/UPDATE, datasource health and the local dashboard.
Do not claim this preparation is an operational Grafana installation.

For future telemetry, provision separate read-only data sources and narrow
database roles for GrideX Timescale measurement history and OpenRemote's
authoritative assets. Dashboard queries must be tenant-scoped before any
customer embedding. OSS Grafana has light/dark themes but not full custom
branding; the GrideX portal should own the approved visual shell, while
charts use its dark green/lime palette. Public access and SSO need a separate
security review and owner approval.
