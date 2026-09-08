# Per-site deployment template — runbook v4.0

Real addresses and keys are entered locally only. This document does not provide commands for a specific router vendor because the models and firmware have not been confirmed. See [SOURCES_EN.md](SOURCES_EN.md), S2–S3 and S9–S10.

## S0. Hardware and firmware acceptance

Confirm routed WireGuard with explicit routes, LAN/VLAN firewalling, anti-spoofing, isolated TELEMETRY SSID/ports, split DNS, NTP/DHCP, configuration backup, and supported security updates. “Includes a VPN client” is not sufficient: full-tunnel-only firmware without isolation and selective routes is not accepted.

Provide a separate administrative/rescue path and protected backup. Verify switch/AP trunk, native, and access VLAN settings; a shared unmanaged switch can bypass the separation. Do not enable public WAN administration, UPnP, or DMZ.

## S1. Private site inventory

Record the site ID, router serial/model/firmware, CONTROL and TELEMETRY prefixes, VPN host address, Edge CONTROL address, and approved devices. Check for conflicts with other sites, site WAN, backend LAN, Docker, WSL, and other VPN networks. OT remains separate behind ROCK Pi and is not included in the Windows peer AllowedIPs.

The router generates its key locally. Only the verified public key is transferred for hub enrollment. A backup containing the private key is secret. A replacement router receives a new identity; a configuration clone must not reuse an existing private key. Machine keys are not rotated manually on a calendar, but software updates and incident-driven revocation remain mandatory.

## S2. Zone separation

- WAN/untrusted customer LAN: transport for the router only; never bridged into EMS.
- CONTROL: ROCK Pi northbound interface.
- TELEMETRY: ESP32/peripherals with client isolation.
- OT: PCS/BMS behind the second ROCK Pi interface and excluded from router VPN routing.

The ROCK Pi CONTROL address is stable. Its CONTROL default route may point to the site router for approved services; OT has no default gateway. The local Edge loop must start safely without router or DHCP availability.

## S3. WireGuard peer

Conceptual fields are in [`../v4/templates/site-router.conf.example`](../v4/templates/site-router.conf.example). Verify the hub public key through a trusted channel.

- Endpoint: `<BACKEND_PUBLIC_ENDPOINT>:51820` through WAN.
- AllowedIPs toward the hub: only `<BACKEND_VPN_IP>/32`.
- Install an explicit route to the hub VPN address through WireGuard.
- Do not add a default Internet route.

Windows registers this peer with the router /32 and its two EMS prefixes. Do not apply SNAT/masquerade to internal VPN traffic; the ordinary NAT used for the outer UDP transport is separate.

`PersistentKeepalive = 25` is an initial setting for NAT traversal, not an EMS heartbeat or a key lifetime. Confirm outbound UDP and reconnection after a NAT change. Do not create inbound EMS port forwarding at the site. CGNAT and mobile transports require actual testing.

## S4. Firewall matrix

| Source | Destination | Rule |
|---|---|---|
| WAN/customer LAN | CONTROL, TELEMETRY, router admin | Deny |
| WireGuard plus hub VPN source | ROCK Pi CONTROL TCP 1502 | Allow only to the approved host |
| TELEMETRY devices | Hub VPN address TCP 8883 | Allow through WireGuard with preserved source addresses |
| EMS devices | Router DNS/NTP/DHCP | Required local services only |
| TELEMETRY | CONTROL, OT, router admin | Deny |
| Site devices | Other site or backend admin/SQL | Deny |
| Site devices | Public MQTT or arbitrary Internet | Deny by default |
| Router control plane | Approved DNS/NTP/update and WireGuard endpoint | Restricted and separate from client forwarding |
| MANAGEMENT | Router/Edge administration | Explicitly approved only; never from TELEMETRY |
| Everything else | Between zones | Deny |

Allow return traffic for established approved connections, but not arbitrary new connections. Match both ingress interface/zone and source/destination. Do not trust a packet merely because it claims the hub source address when it arrived from TELEMETRY.

Apply the same policy to IPv6 or make EMS IPv6 explicitly unavailable. Do not leave an alternate path through router advertisements or default routes.

## S5. DNS, time, TLS, and MQTT

Within EMS DNS, `<EMS_TLS_HOSTNAME>` resolves to `<BACKEND_VPN_IP>`. Devices use only the permitted local DNS and NTP services. Router upstream access is separately restricted. Do not publish a general public A/AAAA record containing the private backend VPN address. DNS or VPN failure is fail-closed; there is no public MQTT fallback.

Each ESP32 uses the DNS hostname, a CA trust store, a unique MQTT client ID, and its own restricted service credential. Never disable TLS hostname or time validation. Plan reliable time bootstrap and CA/firmware updates. Do not use one shared MQTT administrator identity for a complete site.

## S6. Edge and command path

```text
OpenRemote -> routed VPN -> ROCK Pi CONTROL TCP 1502
           -> validated local driver/safety -> vendor OT TCP 3200
```

Unit ID and registers come from the verified device contract, not from the network diagram.

ROCK Pi has no WireGuard client, Linux forwarding to OT, L2 bridge, or cloud module that bypasses local limits. The listener binds to the CONTROL address. Non-fatal listener recovery and an independent local loop remain code requirements. The router does not translate MQTT to Modbus and does not execute BESS strategies.

## S7. Failures and performance

If the router or VPN fails, both cloud channels fail. RS485/OT continue according to the engineered safe state; local safety must not depend on router CPU or boot state. Old telemetry becomes `STALE/UNKNOWN`; command leases are not extended by reconnect attempts. Recovery never replays an old command automatically.

Validate MTU, packet loss, jitter, router CPU, and queueing with bounded tests. MQTT bursts and updates must not consume the EMS heartbeat budget. QoS may be a design control but is not an availability guarantee on an unpredictable WAN.

## S8. Acceptance and repeatability

Start in a laboratory and read-only mode. Execute all applicable tests T71–T95 and the related T01–T70 tests. Adding site N must not change existing site keys or routes. Verify that N cannot reach A or B. Do not clone private keys or certificate private keys from a golden image.

For replacement, generate a new router key, revoke the old peer, and review permissions, DNS, and routes. Revocation history has precedence over older backups. Screenshots, QR configurations, logs, and exports remain private.

Completing this runbook does not authorize real power operation. Physical commissioning and safety verification are separate approvals.
