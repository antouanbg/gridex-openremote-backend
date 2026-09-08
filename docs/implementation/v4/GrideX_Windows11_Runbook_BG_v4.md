# Windows 11 backend — runbook v4.0

**За одобрено локално внедряване, не за изпълнение при качването на документацията.**
Няма достъп до реалната машина от този пакет. Всички стойности се попълват
локално, извън Git. Източници: S1–S5, S8, S11–S12 в [SOURCES.md](SOURCES.md).

## W0. Предварителна проверка и backup

Запази защитен backup на текущите WG, firewall, Docker и router конфигурации.
Осигури локален или отделен аварийно одобрен достъп; не разчитай на тунела,
който предстои да се променя. Съществуващите услуги не се спират без change window.

Провери Windows edition/build, администраторски права, WSL2, Docker Desktop
в Linux containers режим, свободен SSD/RAM, файловите права и политики.
Провери мрежовите интерфейси, route таблицата и текущите listening ports.
Диагностичните резултати съдържат реални адреси — остават само локално.

```powershell
Get-NetConnectionProfile
Get-NetIPConfiguration
Get-NetIPInterface | Select-Object InterfaceAlias, AddressFamily, Forwarding
Get-NetRoute
Get-Service -Name 'WireGuard*' -ErrorAction SilentlyContinue
docker version
docker compose version
```

Не инсталирай втори независим Docker Engine в WSL, ако се използва Docker Desktop.
Не променяй профилите на чужди/корпоративни интерфейси или всички адаптери.

## W1. Частен адресен регистър

Копирай `templates/private-inventory.json.example` извън repository, workspace,
handoff папката и build context. Попълни всички placeholders само там.
Провери всички VPN/CONTROL/TELEMETRY ranges за припокриване с Windows LAN,
WSL, Docker и други VPN-и. Reject на duplicate peer/IP/range.

Windows hub адресът е отделен VPN host адрес. Site peer AllowedIPs включват
неговия router /32 плюс двете му EMS мрежи. OT и клиентските LAN-и не се включват.
Всеки peer е отделно одобрен. Реалните public keys също остават в частния регистър.

## W2. Native WireGuard и защитено съхранение

Използвай официалния, проверен Windows installer и поддържана версия.
Няма WireGuard контейнер и няма WireGuard в WSL.

Генерирай hub private key локално без показване в чат/лог. Подготви конфигурация
по `templates/windows-gridex.conf.example`, първо само с лабораторния site.
Провери fingerprint на публичния ключ на site router по доверен канал.

Използвай официалния manager secure store/DPAPI import. Не измисляй собствен
метод за шифроване. `gridex.conf.dpapi` е защитеният резултат. Обикновен `.conf`
файл не става защитен само защото е подаден на `/installtunnelservice`. [S1]

След удостоверено създаване на правилния DPAPI файл може да се инсталира
тунелната услуга; примерът не генерира ключове:

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

Ако UI вече е създал услугата, само провери състоянието й. Името произлиза от
`gridex` във файла. Single quotes около `WireGuardTunnel$gridex` предотвратяват
PowerShell подмяна на `$gridex`. Провери startup mode и cold boot отделно.
Не включвай script hooks от недоверени конфигурации. Не отпечатвай `showconf`,
dump или private-key полета. `wg show` diagnostics също не се публикуват.

## W3. Централен router/NAT и Windows Firewall

Централният router резервира физическия LAN адрес на Windows.

| Вход | Действие |
|---|---|
| UDP 51820 | Forward само към Windows LAN адреса и същия UDP порт |
| TCP 443 | Само ако има приет публичен HTTPS portal/API/auth план |
| TCP 80 | Само според ACME/redirect плана |
| TCP 8883 | Няма публичен port forward, UPnP или DMZ изключение |
| Други admin/DB/Modbus портове | Няма публично публикуване |

Windows Firewall: default-deny вход с конкретни разрешения.
- WG UDP transport: върху избрания физически uplink; не изисквай фиксирани
  изходящи site WAN IP-и, ако обектите имат променливи адреси.
- MQTTS: само hub VPN LocalAddress, WG interface и одобрени TELEMETRY sources.
- Web: върху изрично разрешените web интерфейси; общо правило за 443 на
  всички interfaces не трябва да дава нов достъп на site peers.
- Site peers не получават Windows admin, SQL, SMB, WinRM, RDP, Docker или
  общ достъп до web/identity endpoints. Human admin path е отделна политика.

Не добавяй „block everything + allow 8883“ с припокриващ се explicit block:
Windows block правилото може да има предимство. Прегледай ефективните правила,
включително наследени широки allowances и security software. Потвърди с
отрицателни тестове, а не само с наличието на ново allow правило.

Не изключвай Windows Firewall. Не допускай blanket allow за всички адреси,
всички profiles или целия `com.docker.backend.exe` без отделна оценка.

## W4. Routes и липса на транзит

След start провери host routes за router /32 и EMS CIDR-ите на всеки peer.
Не добавяй статични маршрути през default gateway, когато WG вече ги управлява.
Провери дали source на host връзка към CONTROL избира hub VPN IP.

За **само** одобрения WG интерфейс може да се наложи forwarding disabled:

```powershell
# Verify the real alias first; do not run against all adapters.
Get-NetIPInterface -InterfaceAlias 'gridex'
Set-NetIPInterface -InterfaceAlias 'gridex' -AddressFamily IPv4 -Forwarding Disabled
```

При IPv6 се прилага отделна проверена политика. Не променяй глобално WSL/
Hyper-V routing. Няма ICS, RRAS или bridge за site traffic. Тествай забраната
site A -> site B, дори ако атакуващият site добави собствен route/AllowedIPs.
Изолацията не може да зависи само от добросъвестния клиентски конфиг.

## W5. Docker ingress и изход към sites

Първо съгласувай един Compose стек и API. Не стартирай двата стари стека.
Manager трябва да има необходимото egress свързване; базите остават private.

За MQTTS е нужна host-specific публикация, концептуално:

```yaml
# Fragment for the reviewed proxy service; NOT a complete Compose file.
ports:
  - target: 8883
    published: "8883"
    host_ip: "${BACKEND_VPN_IP:?Set in protected local environment}"
    protocol: tcp
```

Web mappings се поддържат отделно според плана. **Премахни** стария широк
`8883:8883` entry. Не приемай, че втори Compose overlay го заменя:
merge може да остави и двете mappings. Проверявай ефективния Compose локално;
`docker compose config` може да съдържа разгънати secrets и не се публикува.

Провери, че Docker Desktop спазва host_ip; неподлежаща на изпълнение настройка
е BLOCKED, а не повод за wildcard fallback. Стартирай VPN преди ingress.
Тествай tunnel stop/start и липсващ VPN адрес при startup.

Manager Modbus Agent използва `ROCKPI_CONTROL_IP:1502`, Unit ID по договора.
От реалната Manager network среда провери FC03/FC04 четене и source IP при
router/Edge. Host PowerShell TCP тест е само предварителна диагностика.
Не включвай общ forwarding, за да прикриеш неработещ container route.

## W6. DNS, TLS и MQTT

На site router се задава split DNS за `EMS_TLS_HOSTNAME -> BACKEND_VPN_IP`.
Не променяй публичния DNS към частен адрес. Издавай/подновявай сертификата
за същото DNS име по одобрения ACME процес. Тествай реалното зареждане в
8883 listener и client CA/hostname validation.

Създай по една ограничена MQTT идентичност за всяко устройство, уникален
client ID и права само за собствените telemetry attributes. Без power/
operator/Agent writes. Secret и certificate lifecycle са отделни от WG peer.
Провери revocation на вече установена MQTT сесия, не само нов login.

## W7. Работа без оператор и наблюдение

Провери отделно WireGuard service, Docker Desktop/engine и самия Compose stack
след студен boot без интерактивен login. `restart: unless-stopped` не доказва,
че Docker engine ще се стартира. Ако това не е осигурено на избраната Windows
среда, G2 остава BLOCKED; нужен е поддържан и одобрен deployment вариант.

Мониторингът включва peer availability, но **handshake не е health на EMS**:
следи Modbus read age, MQTT sample age, API/IdP/DB readiness, сертификати,
диск, backup, jobs и независимото известяване при паднал backend.

## W8. Добавяне, отнемане и миграция

Нов site: проверки на адреси/ключ -> добавяне на един peer -> ACL/DNS ->
read-only тест -> отрицателни тестове -> отчет и разрешение.
Не се преиздават всички ключове при добавяне на site.

Revoke: peer се отнема активно и от защитената постоянна конфигурация;
свързаните routes/ACL/inventory се актуализират. Стар backup не възстановява
отнетото доверие. Не рестартирай всички peers без планиран прозорец, ако
избраният инструмент позволява безопасна ограничена промяна.

След успешен router cutover отнеми стария ROCK Pi peer. Провери, че стар
директен MQTTS и старият VPN път са недостъпни. Няма автоматично insecure
връщане. Кодовите/физическите control gates остават задължителни.

## W9. Отчет

Запиши private runbook версия, реални версии/digests, приложени стъпки,
резултати и rollback state. Публичният отчет съдържа само анонимизирани
доказателства. Непроведени тестове остават NOT_RUN.
