# Източници и граници на прегледа

Проверени първични документи за мрежовото предаване: 6 септември 2026 г.
Съдържанието на linked сайтовете може да се променя; изпълнителят проверява
съвместимостта с избраните версии преди системна промяна.

- **S1 — WireGuard Windows услуги, CLI и DPAPI:**
  https://git.zx2c4.com/wireguard-windows/about/docs/enterprise.md
- **S2 — WireGuard cryptokey routing, peers и AllowedIPs:**
  https://www.wireguard.com/
- **S3 — WireGuard ключове, NAT и keepalive:**
  https://www.wireguard.com/quickstart/
- **S4 — Docker Desktop и VPN/host networking:**
  https://docs.docker.com/desktop/features/networking/networking-how-tos/
- **S5 — Docker Compose ports и host_ip:**
  https://docs.docker.com/reference/compose-file/services/
- **S6 — GitHub CLI draft PR:**
  https://cli.github.com/manual/gh_pr_create
- **S7 — GitHub CLI browser login:**
  https://cli.github.com/manual/gh_auth_login
- **S8 — Docker мрежова изолация:**
  https://docs.docker.com/reference/compose-file/networks/
- **S9 — WireGuard протокол и автоматични сесийни ключове:**
  https://www.wireguard.com/protocol/
- **S10 — ACME интеграция и автоматично подновяване:**
  https://letsencrypt.org/docs/integration-guide/
- **S11 — Windows NetIPInterface:**
  https://learn.microsoft.com/en-us/powershell/module/nettcpip/set-netipinterface
- **S12 — Windows Firewall правила:**
  https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule

## Историческа кодова база

Констатациите R01–R20 са пренесени от предоставените документи v3.
В настоящото пакетиране няма нов checkout, build или повторен одит на GitHub.

| Хранилище | Базов commit от v3 |
|---|---|
| antouanbg/gridex-openremote-backend | c215ff7db8e2579bbc7fbeee0daafc1bcf99f810 |
| antouanbg/gridex-energy-os | 6fba45a02830c61cab6773cdd37f436f875f7e86 |
| antouanbg/gridex-edge-gateway | be7f56aa933ae1ca66890b734fb979c0fffe1d74 |

Предходният преглед включва backend API, energy-os API/Compose,
power-command schema, Edge main, Modbus server/register bank,
EdgeController и SafetyEnvelope. Кодовите ревизии не са задължително
текущият main; преди корекции се проверява diff към актуалните ревизии.

Видовете доказателства не се смесват:
- историческа констатация от изходен код;
- проектно решение/изискване от потребителя;
- нов риск от промяната на топологията;
- реално изпълнен тест с доказателство.

Не е правен penetration test, проверка на реален IP, port scan или
сертификация на система/хардуер. Няма гаранция за отсъствие на уязвимости.
