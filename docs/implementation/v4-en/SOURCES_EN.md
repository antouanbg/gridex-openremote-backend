# Sources and review boundaries

Primary network and deployment references reviewed on 6 September 2026. Linked content may change; the implementer must verify compatibility with the selected versions before changing a system.

- **S1 — WireGuard Windows services, CLI and DPAPI:**
  https://git.zx2c4.com/wireguard-windows/about/docs/enterprise.md
- **S2 — WireGuard cryptokey routing, peers and AllowedIPs:**
  https://www.wireguard.com/
- **S3 — WireGuard keys, NAT and keepalive:**
  https://www.wireguard.com/quickstart/
- **S4 — Docker Desktop and VPN/host networking:**
  https://docs.docker.com/desktop/features/networking/networking-how-tos/
- **S5 — Docker Compose ports and `host_ip`:**
  https://docs.docker.com/reference/compose-file/services/
- **S6 — GitHub CLI draft PR:**
  https://cli.github.com/manual/gh_pr_create
- **S7 — GitHub CLI browser login:**
  https://cli.github.com/manual/gh_auth_login
- **S8 — Docker network isolation:**
  https://docs.docker.com/reference/compose-file/networks/
- **S9 — WireGuard protocol and automatic session keys:**
  https://www.wireguard.com/protocol/
- **S10 — ACME integration and automatic renewal:**
  https://letsencrypt.org/docs/integration-guide/
- **S11 — Windows `Set-NetIPInterface`:**
  https://learn.microsoft.com/en-us/powershell/module/nettcpip/set-netipinterface
- **S12 — Windows Firewall rules:**
  https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule

## Historical code baseline

Findings R01–R20 were carried over from the supplied v3 review. The v4 documentation packaging did not perform a new checkout, build, or GitHub audit.

| Repository | v3 baseline commit |
|---|---|
| `antouanbg/gridex-openremote-backend` | `c215ff7db8e2579bbc7fbeee0daafc1bcf99f810` |
| `antouanbg/gridex-energy-os` | `6fba45a02830c61cab6773cdd37f436f875f7e86` |
| `antouanbg/gridex-edge-gateway` | `be7f56aa933ae1ca66890b734fb979c0fffe1d74` |

The previous review covered the backend API, Energy OS API/Compose, power-command schema, Edge main process, Modbus server/register bank, `EdgeController`, and `SafetyEnvelope`. These revisions may not match current `main`; any remediation requires a fresh comparison.

Evidence categories must remain separate:

- historical source-code finding;
- user-approved architecture requirement;
- new risk introduced by the topology change;
- executed test with recorded evidence.

No penetration test, real-address validation, port scan, or system/hardware certification was performed. No absence-of-vulnerability guarantee is made.
