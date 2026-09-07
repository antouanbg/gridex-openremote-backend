# GrideX v4 — security and service-completeness review

Date: 6 September 2026
Status: architecture review; **not a penetration test and not evidence of deployment**. This package has no access to the real Windows host, site router, or Edge device.

## 1. Method and boundaries

R01–R20 are historical findings from the supplied v3 review of the commits listed in [SOURCES_EN.md](SOURCES_EN.md). They were not revalidated against current GitHub `main` and are not closed by the network redesign. R21–R30 are risks and acceptance conditions for the router-VPN topology, not claims that an attack occurred.

The gate rating is not CVSS. G1 blocks a public/read-only pilot, G2 blocks unattended operation, G3 blocks real physical control, and G4 blocks a specific advanced capability. Residual risks include host/router compromise, physical access, supply-chain compromise, and upstream outages. Isolation reduces impact but does not make the system invulnerable.

## 2. Historical open findings

| ID | Gate | v3 basis | Required action/evidence |
|---|---|---|---|
| R01 | G1 | Legacy API returned `/sites` after only a formal Bearer check | Common JWT middleware, per-object/tenant ACLs, and negative tests |
| R02 | G1 | Invalid URI/JSON and slow upstream calls could escape a protected handler | Bounded size, timeout, concurrency, and error handling; process remains alive |
| R03 | G3 | Schema, TTL, and source were not enforced consistently | Fail-closed validation, trusted actor, bounded TTL and lease |
| R04 | G3 | Heartbeat could accept a staging command; replay boundary was incomplete | Atomic commit, heartbeat separation, epoch/sequence/lease tests |
| R05 | G3 | `SiteLimit` was empty in the reviewed local control path | Real local meter/contract data and a validated stale fallback |
| R06 | G3 | Blocking Modbus client could stall service or shutdown | IO/idle deadlines, bounded buffers, interruptible connections |
| R07 | G3 | Failed northbound startup terminated Edge before the local loop | Independent local loop and listener retry without wildcard fallback |
| R08 | G3 | Reported applied zero/fresh timestamp did not prove measured state | Separate requested, sent, acknowledged, measured, and `UNKNOWN` states |
| R09 | G1 | API used bootstrap `POSTGRES_USER` in a new deployment | Separate runtime, migration, and administration roles; no app superuser |
| R10 | G1 | Shared DB network and missing Manager egress | Segmentation plus positive and negative connectivity tests |
| R11 | G3 | BFF write lock could be bypassed through direct OpenRemote/MQTT rights | Protection in every authoritative executor and Edge; test every channel |
| R12 | G1 | Audience and tenant identity were not fully fail-closed | Issuer/audience/sub+tenant schema and per-route/per-job ACLs |
| R13 | G1 | HAProxy API routing and administrative isolation were not proven | Real hostname routing, TLS, trusted proxy, and admin ACL evidence |
| R14 | G1 | Floating versions and unverified runtime privileges | Verified digests, SBOM/advisories, restrictions, no Docker socket |
| R15 | G1 | Enrollment/revoke helper introduced an administrative component | Restricted local operation, trusted enrollment, no public admin API |
| R16 | G2 | WireGuard service did not prove Docker Desktop boot | Cold boot without login and separate engine/stack readiness evidence |
| R17 | G2/G4 | Six services did not implement the entire product | Tested jobs, provisioning, notifications, forecasting, and backup ownership |
| R18 | G2 | Restore could reintroduce revoked trust or old command state | Trust-ledger precedence, safe locked restore, measured RPO/RTO |
| R19 | G1 | Portal/build/CI/third-party dependencies are trust boundaries | Secret/build checks, CSP/token hygiene, signed and approved artifacts |
| R20 | G1/G2 | IPv6, DDoS, and physical access were not exhausted by a VPN | Negative network tests, updates, rescue, and availability plan |

Every R01–R20 status is **OPEN — REVALIDATE_ON_CURRENT_CODE**. The network change reduces the specific `wg0` bind scenario in R07 but does not resolve a missing CONTROL address or an occupied port.

## 3. New router-VPN topology risks

| ID | Gate | Risk | Required control and acceptance |
|---|---|---|---|
| R21 | G1 | Overlapping site/Docker/WSL prefixes or incorrect peer routes | Reject overlaps; per-peer /32 plus two prefixes; T72/T73/T94 |
| R22 | G1/G3 | ESP32 and Edge on one L2 segment could bypass router ACLs | CONTROL/TELEMETRY VLAN or port isolation and anti-spoofing; T74–T77 |
| R23 | G1 | Windows transit or broad interface allowances expose another site/admin | Disable hub forwarding, no bridge/ICS, negative tests; T78/T79 |
| R24 | G1 | Legacy public MQTTS or broad Compose mapping remains active | VPN-address bind and removal of NAT/UPnP/broad rules; T80–T82 |
| R25 | G1 | Split DNS/TLS/time failure causes public fallback or disabled validation | Fail-closed DNS/CA/hostname/time and router-only DNS/NTP; T83/T84 |
| R26 | G2/G3 | Router/VPN is a shared failure point for Modbus and MQTT | No independent-cloud claim; local safety and stale-data handling; T85/T86 |
| R27 | G1/G2 | Stolen or cloned router key grants site-level network identity | Unique key, private backup, active/persistent revoke, MQTT ACL; T89/T90 |
| R28 | G2 | Windows/WireGuard restart loses address, binding, or routes | Startup ordering, fail-closed binding, recovery tests; T81/T87/T88 |
| R29 | G1/G3 | VPN masquerade hides source or Docker source differs from design | No site SNAT, measured source, no broad AllowedIPs expansion; T71/T91 |
| R30 | G1/G3 | Incomplete migration/rollback restores an old peer, public MQTT, or dispatch | Read-only canary, legacy-path removal, safe rollback; T92/T93/T95 |

Every R21–R30 status is **OPEN — DESIGN_CONTROL_NOT_YET_TESTED**.

## 4. Controls that must not be omitted

A router peer authenticates the router and its permitted source prefixes, not individual devices behind it. A compromised router may impersonate devices within its prefixes. Per-device MQTT credentials and Asset ACLs remain required. Following compromise, revoke the site peer and assess all device credentials and firmware.

A site administrator can alter local AllowedIPs. Hub and firewall isolation must therefore prevent site-to-site traffic even when the client configuration is hostile.

A Windows Firewall scope on the Docker backend process is not proof of per-container isolation. Proxy/API compromise requires separate assessment. Application workers must not receive unrestricted routes to every device.

The router does not replace host filtering or local safety on Edge. Modbus does not gain cryptographic authentication merely because it is on a LAN; VLAN and host ACLs constrain the trusted surface.

Test CGNAT, MTU, and WAN latency. A non-expiring machine key does not remove update, revocation, or monitoring requirements. There is no public device/control fallback during a VPN outage.

## 5. Service-completeness matrix

| Component/function | Acceptance result |
|---|---|
| Windows WireGuard and site peers | Protected key store, active/persistent state, routes, revoke and restore |
| Site VLAN/DHCP/DNS/NTP | Negative isolation, address lifecycle, TLS time bootstrap |
| HAProxy and ACME | API routing, VPN-only MQTT, real renew/reload, admin restrictions |
| Keycloak/OIDC | Realm/client provisioning, PKCE, token claims, role/Asset ACL, session revoke |
| OpenRemote | Assets, agents, history, rules, restricted executor, quality/age, command leases |
| GrideX API | One contract, real auth/tenancy, deadlines, rate limits, audit |
| Two PostgreSQL databases | Versioned migrations, least privilege, separate backup and restore |
| Device MQTT | Unique client ID, own-Asset telemetry, TLS trust, stale/fallback policy |
| Edge local control | Safe boot, bounded IO, BMS/site limits, readback, local watchdog |
| Worker/notifications | Queue, retry budget, outbox, visible failed delivery, no control bypass |
| Monitoring | Independent alerting during host failure, not only a local dashboard |
| CI/build/updates | Verified artifacts, dependency scan, secret-free logs, canary rollback |
| Forecasting/optimiser | Later gate; validated data/units/time and no device credentials |
| Human operations | MFA/admin separation, private inventory, rescue/change/incident procedures |

Not every row requires a new container. Every function requires an owner, an implemented procedure, and an acceptance test. Certificates, migrations, and backups do not appear automatically from a six-service Compose stack.

## 6. Evidence and release decision

Static review, WireGuard handshake, TCP connection, HTTP health, Modbus read, command acknowledgment, and physically measured result are different evidence types. None substitutes for another.

The [acceptance tests](GrideX_Acceptance_Tests_EN_v4.md) remain `NOT_RUN` until actual execution. G0 allows isolated development. G1–G4 require their corrections and evidence; a documentation PR closes no release gate. This review makes no claim of “no gaps” or “no vulnerabilities.”
