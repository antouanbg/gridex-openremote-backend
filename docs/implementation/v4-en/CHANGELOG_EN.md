# Changes in version 4.0

| Area | v3 | v4 — effective decision |
|---|---|---|
| Site VPN | WireGuard on ROCK Pi | WireGuard on the dedicated EMS site router |
| Machine VPN identity | Per ROCK Pi | Unique router/site key |
| ESP32 to backend | Independent public MQTTS | MQTTS through the site-router tunnel; no WAN fallback |
| Central MQTTS ingress | Public TCP 8883 | TCP 8883 only on the backend VPN address |
| Windows AllowedIPs | Edge tunnel host | Router tunnel host plus the site's CONTROL and TELEMETRY prefixes |
| Site networks | Limited VPN addressing | Unique CONTROL and TELEMETRY networks plus a separate, unreachable OT network |
| ROCK Pi listener | Possible bind to a `wg0` address | Bind to the CONTROL address; no VPN-service dependency |
| Router/VPN failure | Multiple possible cloud paths | Both Modbus and cloud MQTTS stop; local RS485/OT operation remains |
| Keys | Persistent machine keys | Same policy, with site-router enrollment and revocation |
| Security | R01–R20 and T01–T70 | Retained and extended with R21–R30 and T71–T95 |

The six core services, separate GrideX PostgreSQL database, HAProxy, unified API contract, least-privilege roles, anti-replay/TTL/lease requirements, local limits, backup/restore, verified updates, and acceptance before real control remain required.

This package does not introduce Nginx, TimescaleDB, or a second MQTT broker. Any other document or illustration showing them does not define this architecture.

This is a revised plan, not a report of completed implementation.
