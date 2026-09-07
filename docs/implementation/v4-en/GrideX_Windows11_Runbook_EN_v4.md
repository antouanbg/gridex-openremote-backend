# Windows 11 backend — runbook v4.0

**For an approved local deployment; not to be executed while publishing the documentation.** All deployment values are populated locally outside Git. References: S1–S5, S8, and S11–S12 in [SOURCES_EN.md](SOURCES_EN.md).

## W0. Preflight and backup

Create protected backups of the current WireGuard, firewall, Docker, and router configuration. Ensure local or separately approved rescue access; do not rely on the tunnel being modified. Existing services are not stopped without a change window.

Verify the Windows edition/build, administrative access, WSL2, Docker Desktop in Linux-container mode, free SSD/RAM capacity, file permissions, and policies. Review network interfaces, routes, and current listeners. Diagnostic output contains actual addresses and remains local.

```powershell
Get-NetConnectionProfile
Get-NetIPConfiguration
Get-NetIPInterface | Select-Object InterfaceAlias, AddressFamily, Forwarding
Get-NetRoute
Get-Service -Name 'WireGuard*' -ErrorAction SilentlyContinue
docker version
docker compose version
```

Do not install a second independent Docker Engine inside WSL when Docker Desktop is used. Do not change unrelated corporate interface profiles or every adapter.

## W1. Private address registry

Copy [`../v4/templates/private-inventory.json.example`](../v4/templates/private-inventory.json.example) outside the repository, workspace, handoff directory, and build context. Populate placeholders only in that private location.

Check every VPN, CONTROL, and TELEMETRY prefix for overlap with the Windows LAN, WSL, Docker, other VPNs, and other sites. Reject duplicate peers, addresses, or prefixes.

The Windows hub has its own VPN host address. Each Windows site peer AllowedIPs contains exactly that site's router /32 plus its CONTROL and TELEMETRY prefixes. OT and customer LANs are excluded. Verified public keys remain in the private registry.

## W2. Native WireGuard and protected storage

Use the official, verified Windows installer and a supported release. There is no WireGuard container and no WireGuard inside WSL.

Generate the hub private key locally without printing it in chat or logs. Prepare the configuration from [`../v4/templates/windows-gridex.conf.example`](../v4/templates/windows-gridex.conf.example), initially with the laboratory site only. Verify the site-router public-key fingerprint over a trusted channel.

Use the official manager secure store/DPAPI import. Do not invent a custom encryption process. `gridex.conf.dpapi` is the protected result; a plaintext `.conf` file does not become protected merely because it is passed to `/installtunnelservice`. [S1]

After the correct DPAPI file has been created and verified, the service may be installed. This example does not generate keys:

```powershell
# Run locally as Administrator after approved secure configuration import.
$wgExe = Join-Path $env:ProgramFiles 'WireGuard\wireguard.exe'
$secureConfig = Join-Path $env:ProgramFiles 'WireGuard\Data\Configurations\gridex.conf.dpapi'
if (-not (Test-Path -LiteralPath $wgExe)) { throw 'WireGuard is not installed.' }
if (-not (Test-Path -LiteralPath $secureConfig)) { throw 'Secure configuration is missing.' }
if (Get-Service -Name 'WireGuardTunnel$gridex' -ErrorAction SilentlyContinue) {
    throw 'Tunnel service already exists. Review it; do not replace automatically.'
}
& $wgExe /installtunnelservice $secureConfig
if ($LASTEXITCODE -ne 0) { throw 'Tunnel installation failed.' }
Get-Service -Name 'WireGuardTunnel$gridex'
```

If the UI already created the service, inspect it without replacing it. The service name derives from `gridex` in the file. Single quotes around `WireGuardTunnel$gridex` prevent PowerShell from expanding `$gridex`. Verify startup mode and a cold boot separately. Do not execute hooks from untrusted configurations or print `showconf`, dumps, private-key fields, or `wg show` diagnostics publicly.

## W3. Central router/NAT and Windows Firewall

The central router reserves the Windows physical LAN address.

| Inbound service | Action |
|---|---|
| UDP 51820 | Forward only to the Windows LAN address on the same UDP port |
| TCP 443 | Only for an approved public portal/API/authentication plan |
| TCP 80 | Only according to the ACME/redirect plan |
| TCP 8883 | No public forwarding, UPnP, or DMZ exception |
| Other administration, DB, or Modbus ports | Never published |

Use default-deny inbound Windows Firewall rules with narrow exceptions:

- WireGuard UDP transport only on the selected physical uplink.
- MQTTS only on the hub VPN local address and interface and from approved TELEMETRY sources.
- Web only on explicitly approved interfaces; a broad TCP 443 rule must not grant site peers access to administration.
- Site peers receive no Windows administration, SQL, SMB, WinRM, RDP, Docker, or general identity/web administration access.

Do not combine an explicit broad block with an overlapping allow rule without checking effective precedence. Review inherited allowances and security software. Verify with negative tests. Never disable Windows Firewall or add blanket allowances for every address, profile, or the complete `com.docker.backend.exe` process without a separate assessment.

## W4. Routes and absence of transit

After startup, inspect host routes for each router /32 and EMS prefix. Do not add static routes through the default gateway when WireGuard already manages them. Confirm that a host connection to CONTROL uses the hub VPN source address.

Forwarding may need to be explicitly disabled on the approved WireGuard interface only:

```powershell
# Verify the real alias first; do not run against all adapters.
Get-NetIPInterface -InterfaceAlias 'gridex'
Set-NetIPInterface -InterfaceAlias 'gridex' -AddressFamily IPv4 -Forwarding Disabled
```

Apply a separate verified IPv6 policy. Do not alter global WSL/Hyper-V routing. Do not enable ICS, RRAS, or bridging for site traffic. Test that site A cannot reach site B even if a compromised site changes its local routes or AllowedIPs.

## W5. Docker ingress and site egress

Consolidate on one reviewed Compose stack and one API before deployment. Do not start both legacy stacks. OpenRemote Manager requires controlled egress toward sites; databases remain private.

MQTTS requires a host-specific binding:

```yaml
# Fragment for the reviewed proxy service; NOT a complete Compose file.
ports:
  - target: 8883
    published: "8883"
    host_ip: "${BACKEND_VPN_IP:?Set in protected local environment}"
    protocol: tcp
```

Maintain web mappings separately. Remove the old broad `8883:8883` mapping. Do not assume a Compose overlay replaces it; merged configuration can retain both entries. Inspect the effective configuration locally and never publish expanded secrets.

Confirm that Docker Desktop honors `host_ip`. If it does not, deployment is `BLOCKED`; do not substitute a wildcard bind. Start the VPN before ingress and test tunnel stop/start plus startup without the VPN address.

OpenRemote Manager's Modbus Agent connects to `ROCKPI_CONTROL_IP:1502` with the contract-defined unit ID. Test FC03/FC04 from the actual Manager network environment and verify the source address at the router and Edge. A host PowerShell TCP test is preliminary diagnostics only. Do not enable broad forwarding to hide a broken container route.

## W6. DNS, TLS, and MQTT

Configure site split DNS so `<EMS_TLS_HOSTNAME>` resolves to `<BACKEND_VPN_IP>`. Do not point public DNS at a private VPN address. Issue and renew a certificate for the same hostname using the approved ACME process. Verify that the live TCP 8883 listener loads it and that clients validate both CA and hostname.

Create a restricted MQTT identity and unique client ID for every device. Grant access only to that device's telemetry attributes; deny power, operator, and Agent writes. Secret/certificate lifecycle remains separate from the WireGuard peer lifecycle. Test revocation of an already established MQTT session.

## W7. Unattended operation and monitoring

Independently test the WireGuard service, Docker Desktop/engine, and Compose stack after a cold boot without interactive login. `restart: unless-stopped` does not prove that Docker itself starts. If unattended startup is unsupported in the selected Windows environment, G2 remains `BLOCKED` and a supported deployment alternative is required.

Monitor peer availability, but do not treat a handshake as EMS health. Monitor Modbus read age, MQTT sample age, API/IdP/DB readiness, certificates, disk, backups, and jobs. Provide an independent alert path for total backend failure.

## W8. Enrollment, revocation, and migration

For a new site: validate addresses and key, add exactly one peer, configure ACL/DNS, run read-only and negative tests, then record approval. Existing site keys are not reissued.

Revocation removes the peer from both active and persistent configuration and updates routes, ACLs, and inventory. An old backup must not restore revoked trust. Avoid restarting all peers when the selected tooling supports a safe, scoped change.

After successful router cutover, revoke the old ROCK Pi peer. Verify that the legacy direct MQTTS and VPN paths are unavailable. There is no automatic insecure fallback. Code and physical control gates remain mandatory.

## W9. Deployment report

Record the private runbook version, actual versions/digests, applied steps, test results, and rollback state. Public reports contain sanitized evidence only. Unexecuted tests remain `NOT_RUN`.
