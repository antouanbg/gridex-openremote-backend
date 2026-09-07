# GrideX v4 — acceptance tests

Date: 6 September 2026
**95 tests; all `NOT_RUN`. This is a test plan, not a successful installation report.**

T01–T70 are retained and adapted from v3 without removing API, control, or database requirements. T71–T95 validate the router-VPN topology. Risks are defined in the [security review](GrideX_Security_Service_Review_EN_v4.md), and release gates in the [implementation plan](GrideX_Backend_Deployment_Plan_EN_v4.md).

Begin with simulators and an isolated site. Real endpoints and equipment are tested only within an approved scope and with an engineer. Never run unbounded DoS/load tests against an operating BESS. An optional test is closed as `NOT_APPLICABLE` with a reason, not deleted.

| ID | Gate | Test | Expected result | Risks | Status |
|---|---|---|---|---|---|
| T01 | G2 | Cold Windows boot without login/UI | Native WireGuard and the Docker stack are verified separately; API/IdP/DB readiness recovers. | R16 | NOT_RUN |
| T02 | G3 | ROCK Pi boots without site router/DHCP/WAN | Local controller and RS485 operate in the validated safe state; no Edge WireGuard or cloud dependency. | R07,R26 | NOT_RUN |
| T03 | G3 | Missing bind address or occupied northbound port | Listener failure does not stop the controller and never opens a wildcard fallback. | R07 | NOT_RUN |
| T04 | G3 | CONTROL address/connectivity appears after offline boot | Only listener/routing recovers; the safety loop is not restarted and no old command is applied. | R07,R04 | NOT_RUN |
| T05 | G1 | Manager to Edge from the actual container network | FC03/FC04 succeeds with verified route, source, and ACL; a host TCP test alone is insufficient. | R10 | NOT_RUN |
| T06 | G1 | Northbound access from unauthorized WAN/OT interface | TCP 1502 is denied; the vendor port remains local to OT. | R20,R11 | NOT_RUN |
| T07 | G1 | Compromised Edge attempts another peer or Windows administration | Other sites, SMB, RDP, WinRM, SQL, and Docker are denied; the hub provides no transit. | R10,R20 | NOT_RUN |
| T08 | G1 | Missing, invalid, expired, wrong-audience, or wrong-issuer JWT | Every protected endpoint rejects it, including `/sites` and requests without Origin. | R01,R12 | NOT_RUN |
| T09 | G1 | MQTT node writes another Asset, control attribute, or Agent | Write is denied while permitted own-device telemetry continues. | R11 | NOT_RUN |
| T10 | G3 | Only the site WireGuard tunnel is stopped | Cloud Modbus and MQTTS fail together; the local loop remains and there is no public MQTT fallback. | R07,R04,R26 | NOT_RUN |
| T11 | G3 | EMS heartbeat is lost | Defined timeout and IO/tick budget produce the proven safe state without silently extending the timeout. | R04,R08 | NOT_RUN |
| T12 | G3 | VPN returns after a command lease expired | No replay; a new valid command transaction and lease are required. | R04 | NOT_RUN |
| T13 | G1 | MQTT fails while Modbus/RS485 remains | Source selection follows explicit quality/age rules without double counting. | R08 | NOT_RUN |
| T14 | G1 | Both telemetry sources become stale | State is `STALE/UNKNOWN`; an HTTP timestamp never makes old data appear live. | R08 | NOT_RUN |
| T15 | G3 | BMS/PCS communication is lost | Invalid limits are not used; watchdog/fallback behavior is physically measured, not inferred from UI. | R08,R05 | NOT_RUN |
| T16 | G3 | Manager/Docker restarts | Local safety is independent of backend restart and reconnect performs no stale writes. | R04,R07 | NOT_RUN |
| T17 | G2 | WAN NAT change, packet loss, jitter, and MTU variation | Recovery is controlled and bounded, with no public Modbus workaround. | R06,R20 | NOT_RUN |
| T18 | G2 | Revoked peer after restoring an old configuration | Current revocation ledger wins; the revoked key remains blocked. | R15,R18 | NOT_RUN |
| T19 | G1 | ACME renewal and live TLS reload | HTTPS and MQTTS present the renewed certificate and renewal failure generates an alert. | R13 | NOT_RUN |
| T20 | G1 | Authorized external IPv4 and IPv6 exposure check | Only approved services are reachable; no admin, DB, development, or device-control exposure exists. | R20 | NOT_RUN |
| T21 | G4-OPTIONAL | Future ROCK Pi MQTT publisher is offline | No local WG; queue is bounded, original timestamps remain, and safety-loop timing is unaffected. | R08,R17 | NOT_RUN |
| T22 | G1 | Router machine key across reboots and updates | Key remains persistent and is not reissued on reconnect; session keys rotate automatically. | R15,R27 | NOT_RUN |
| T23 | G1 | Two site routers provisioned from one golden image/template | Private keys differ; duplicate peer, address, or prefix is rejected during enrollment. | R15,R21,R27 | NOT_RUN |
| T24 | G1 | Unverified initial enrollment | Automatic approval is denied; trusted fingerprint and site ownership are required. | R15 | NOT_RUN |
| T25 | G1 | Active peer revoked and system rebooted | Access stops immediately and after reboot; active and persisted state match; other peers remain. | R15 | NOT_RUN |
| T26 | G2 | Server-key recovery on a clean machine | Portable encrypted recovery and DPAPI rewrap are proven without private keys in logs. | R18 | NOT_RUN |
| T27 | G2 | Compromised server-key scenario | Old trust is revoked, the new fingerprint is delivered through a trusted path, and safe downtime is used if needed. | R15,R18 | NOT_RUN |
| T28 | G1 | Secret/address scan of release artifacts | No real addresses, inventory, keys, bundles, images, ZIP contents, or public-log leakage. | R19,R15 | NOT_RUN |
| T29 | G1 | Runtime database-role privilege test | No `SUPERUSER`, `BYPASSRLS`, role creation, or schema ownership; migrations use a separate role. | R09 | NOT_RUN |
| T30 | G1 | Cross-tenant requests and pooled DB connections | Isolation does not rely only on UI, `sub`, or email; tenant context never leaks between requests. | R12,R09 | NOT_RUN |
| T31 | G1 | Negative container-connectivity matrix | Proxy, API, Manager, and workers reach only required DB/API/data endpoints; denied paths are observed. | R10 | NOT_RUN |
| T32 | G1 | Invalid URI/JSON and interrupted HTTP request | Contract-defined 400/413 response; process remains alive with no unhandled rejection. | R02 | NOT_RUN |
| T33 | G1 | Slow upstream and many permitted requests | Deadlines, rate/concurrency limits, and backpressure bound memory and connections. | R02 | NOT_RUN |
| T34 | G3 | Invalid TTL/fields and spoofed source/actor | Schema rejects fail-closed; identity and source never come from free client text. | R03 | NOT_RUN |
| T35 | G3 | Interleaved Modbus writes between controller ticks | Only a committed transaction applies; heartbeat never activates a staging snapshot. | R04 | NOT_RUN |
| T36 | G3 | Duplicate/old sequence, wrap, and reboot epoch | Idempotent anti-replay behavior is defined; one command cannot execute twice. | R04 | NOT_RUN |
| T37 | G3 | Heartbeat continues after command lease expiry | The old setpoint is not renewed; a new valid lease transaction is required. | R04 | NOT_RUN |
| T38 | G3 | Local meter load and contract limit | The real controller enforces site headroom; stale/missing meter uses an engineered fallback. | R05 | NOT_RUN |
| T39 | G3 | PCS write failure/timeout and unavailable readback | State becomes `UNKNOWN/FAULT` with alarm; reported zero is not presented as measured zero. | R08 | NOT_RUN |
| T40 | G3 | Direct HTTP/MQTT/WebSocket write attempt during write lock | BFF gate cannot be bypassed; protected executor and Edge deny the control write. | R11 | NOT_RUN |
| T41 | G1/G3 | Roles and MFA for critical human actions | Viewer/node cannot control; operator cannot change safety limits; approval and actor are audited. | R11,R12 | NOT_RUN |
| T42 | G1 | OIDC login/logout/refresh and signing-key rollover | PKCE, issuer, audience, expiry, and JWKS work without insecure DNS/TLS bypass. | R12,R13 | NOT_RUN |
| T43 | G1 | Device TLS trust-store/CA update | Valid chain works after update; unknown or incorrect certificate is rejected. | R13,R15 | NOT_RUN |
| T44 | G1 | Revoke MQTT/WebSocket identity during an established session | Active session loses access or is terminated; testing is not limited to a new login. | R11,R15 | NOT_RUN |
| T45 | G2 | Firmware/OS/configuration update and rollback | Artifact and scope are verified with canary; no unsigned or untrusted script runs. | R14,R19 | NOT_RUN |
| T46 | G1 | Effective runtime users, capabilities, mounts, and limits | Least privilege is proven; no Docker socket or host secrets; supported images run. | R14 | NOT_RUN |
| T47 | G1 | Migrations/provisioning repeated or resumed after partial failure | Operations are idempotent and versioned; wrong DB target is rejected without data loss. | R09,R17 | NOT_RUN |
| T48 | G2 | Full restore into an isolated clean environment | RPO/RTO measured; identity, Assets, and business data return with writes initially locked. | R18 | NOT_RUN |
| T49 | G2 | Worker restarts during a business/outbox job | No lost or duplicate business action; retry budget and dead-letter state are visible. | R17 | NOT_RUN |
| T50 | G2 | SMTP/webhook provider unavailable | Queue, retry, delivery state, and independent alerting work without blocking telemetry/control. | R17 | NOT_RUN |
| T51 | G3 | Clock skew/UTC jump and offline time bootstrap | Command timeout uses monotonic time; TLS/JWT fail closed; local safety continues. | R04,R13 | NOT_RUN |
| T52 | G3 | PCS/BMS watchdog and failed local process | Physical safe behavior is measured and engineer-approved, not just a software flag. | R08 | NOT_RUN |
| T53 | G1/G3 | Audit and sensitive diagnostic output | Actor, decision, and command lifecycle are traceable without token, private-key, or personal-data leakage. | R03,R19 | NOT_RUN |
| T54 | G1 | Frontend OIDC callback, CSP, XSS, and token exposure | Bundle contains no secrets or unsafe rendering; expired/revoked session cannot control. | R19 | NOT_RUN |
| T55 | G4 | Forecast calibration/validation and model rollback | Walk-forward/site-quality backtest, versioned model, and no direct device credentials. | R17 | NOT_RUN |
| T56 | G4 | Optimiser/15-minute schedule, units, timezone, and DST | One executor applies bounded versioned schedules; unit/time errors never become writes. | R03,R04,R17 | NOT_RUN |
| T57 | G1 | SBOM/dependency/image advisory scan | Actual digests are scanned; applicable high-risk findings are fixed or explicitly assessed. | R14 | NOT_RUN |
| T58 | G2 | Full disk, DB outage, and growing logs | Alerts, retention, backpressure, recovery, and local safe state operate. | R14,R18 | NOT_RUN |
| T59 | G2 | Backend or its Internet connection is down | Independent monitoring alerts; a local green dashboard is not the only observer. | R17,R20 | NOT_RUN |
| T60 | G2/G3 | DB/VPN/configuration rollback | Revoked keys, active command queues, and old commissioning approval are not restored. | R18 | NOT_RUN |
| T61 | G1 | Helper receives invalid routes, keys, or hooks | Allowlist schema rejects them; no shell injection, arbitrary path, or full-tunnel expansion. | R15 | NOT_RUN |
| T62 | G1 | Initial TLS/IdP/bootstrap from an empty environment | No circular health/proxy/ACME dependency; provisioning is reproducible and recoverable. | R13,R17 | NOT_RUN |
| T63 | G2 | Simulated WAN saturation or complete cloud loss | Local behavior remains safe and upstream limits are documented without availability guarantees. | R20 | NOT_RUN |
| T64 | G1 | Liveness vs readiness and both API contracts | One schema/response contract; a green process cannot hide offline dependencies or missing migrations. | R01,R17 | NOT_RUN |
| T65 | G4 | Provider inputs/webhooks and SSRF restrictions | Destinations, schema/signature, size/time, timestamp, and units are controlled; no arbitrary URL fetch. | R17 | NOT_RUN |
| T66 | G3 | Measured IO/tick/heartbeat budget under load | Engineering limits retain margin; timeout is never increased to hide a defect. | R04,R06,R08 | NOT_RUN |
| T67 | G3 | Modbus idle/partial frame and service stop | Slow clients cannot block listening or shutdown outside the budget; sockets close cleanly. | R06 | NOT_RUN |
| T68 | G1 | Secret ACL and access from normal users/containers | WireGuard keys and DB admin secrets are unreadable to API, Codex, and workspace; protected storage is verified. | R15,R14 | NOT_RUN |
| T69 | G4 | Configuration revision: Sent versus Applied | UI reports Applied only after independent applied-state evidence; HTTP 202 is insufficient. | R17,R08 | NOT_RUN |
| T70 | G1/G4 | Tenant permissions for exports, reports, history, alarms, and jobs | Every endpoint, subscription, and job checks organisation/site, not only `/sites`. | R01,R12,R17 | NOT_RUN |
| T71 | G1 | End-to-end Manager to router to ROCK Pi | FC03/FC04 from the real Manager; packet source and reply route proven without broad bypass. | R29,R10 | NOT_RUN |
| T72 | G1 | Duplicate/overlapping peer prefixes or overlap with Docker/WSL | Enrollment rejects the conflict before activation without affecting existing sites. | R21 | NOT_RUN |
| T73 | G1 | Windows peer routes and router AllowedIPs | Router /32 plus its two EMS prefixes only; router points to hub /32; no OT/default route. | R21 | NOT_RUN |
| T74 | G1 | TELEMETRY device attempts CONTROL TCP 1502 | Router/L2 boundary denies it while normal MQTTS continues. | R22 | NOT_RUN |
| T75 | G1 | TELEMETRY port/SSID spoofs the hub source address | Ingress-zone anti-spoofing rejects it; an address string does not grant trust. | R22 | NOT_RUN |
| T76 | G1 | ESP32 attempts another ESP32 on the same SSID/switch | Client/port isolation is proven or a narrower approved policy is documented. | R22 | NOT_RUN |
| T77 | G1 | VLAN trunk/native/access errors and IPv6 bypass | No L2 bridge or alternate path reaches CONTROL/customer LAN; IPv6 is restricted. | R22,R20 | NOT_RUN |
| T78 | G1 | Site A changes AllowedIPs and attempts site B | Hub does not forward; client configuration is not the only protection. | R23 | NOT_RUN |
| T79 | G1 | Site sources attempt hub SMB/RDP/WinRM/SQL/web administration | Denied independently of web rules on the physical uplink. | R23 | NOT_RUN |
| T80 | G1 | External IPv4/IPv6 access to MQTT TCP 8883 | Unreachable publicly; no NAT/UPnP/broad Compose mapping; private MQTTS works. | R24 | NOT_RUN |
| T81 | G1/G2 | WireGuard address absent when Docker ingress starts | Fail-closed with no wildcard MQTT fallback, plus alerting and controlled recovery. | R24,R28 | NOT_RUN |
| T82 | G1 | Compose merges old and new port mappings | Effective configuration contains one approved VPN-only TCP 8883 bind and no broad legacy entry. | R24 | NOT_RUN |
| T83 | G1 | Split DNS to hub and wrong DNS/CA/hostname | Correct name works; incorrect TLS fails; no public fallback exists. | R25 | NOT_RUN |
| T84 | G1 | ESP time bootstrap and DNS/NTP permissions | Local services work without arbitrary Internet egress and TLS validation stays enabled. | R25 | NOT_RUN |
| T85 | G3 | Site-router power is physically removed | Both cloud IP paths fail while RS485/OT and the engineered local safe state remain. | R26 | NOT_RUN |
| T86 | G3 | Router CPU load, MQTT burst, and jitter under bounded test | Resources and heartbeat remain bounded; stale commands are not accepted as new. | R26,R04 | NOT_RUN |
| T87 | G2 | Windows WireGuard interface destroyed and recreated | VPN-only bindings and routes recover without public exposure. | R28 | NOT_RUN |
| T88 | G2 | Cold Windows boot without user login | WireGuard, Docker engine, containers, certificate, and data readiness are independently proven. | R28,R16 | NOT_RUN |
| T89 | G1 | Stolen router key revoked on an active site | New and active VPN paths terminate; persistent state does not restore access. | R27 | NOT_RUN |
| T90 | G2 | Old router/hub backup restored | Revocation ledger is authoritative; no duplicate identity or peer resurrection occurs. | R27,R18 | NOT_RUN |
| T91 | G1 | Site VPN masquerade or unexpected Docker source | Test detects the source change and blocks deployment until narrowly corrected. | R29 | NOT_RUN |
| T92 | G1 | Cutover from ROCK Pi WireGuard to router WireGuard | New routed path works, old peer is revoked, and ROCK Pi has no active VPN dependency. | R30 | NOT_RUN |
| T93 | G1 | Legacy public MQTT, router, or WireGuard path after migration | No old bypass remains; credentials and mappings are accounted for. | R30 | NOT_RUN |
| T94 | G1/G2 | Add a new site N | Existing sites retain keys/routes and N cannot reach any other site. | R21,R23 | NOT_RUN |
| T95 | G2/G3 | Rollback or partially failed migration | Writes remain locked; no public MQTT, revoked key, or command replay returns; rescue access works. | R30,R18 | NOT_RUN |

## Per-test report

```text
test_id:
release_commit_or_digest:
private_environment_reference:
method:
expected:
observed:
status: NOT_RUN | PASS | FAIL | BLOCKED | NOT_APPLICABLE
sanitized_evidence_reference:
reviewer:
date:
reason_for_not_applicable:
unresolved_risks:
```

Actual addresses, keys, packet captures, logs, and permissions remain private. Public reports contain sanitized evidence only. Documentation validation, WireGuard handshake, TCP connection, Modbus read, and a physically measured result are distinct evidence categories.
