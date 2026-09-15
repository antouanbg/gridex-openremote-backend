# Selective WireGuard preparation / Изолиран WireGuard — подготовка

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## English

Owner instruction, 2026-09-15: PREPARE ONLY. Do not activate until the owner
confirms ROCK Pi relocation and authorizes activation. No runtime changes made.
No image pulled, key generated, container started, port opened or Mac Ethernet,
DNS, DHCP, route/default gateway changed by this preparation.

### Intended boundary (not deployed)

```text
ROCK Pi -> Site Router == WireGuard == isolated VPN container
                                          |
                                TCP relay (TLS passthrough)
                                          |
                                     MQTT broker
                                          |
                            ingestion -> PostgreSQL/OpenRemote
```

Only the VPN container and dedicated MQTT TCP relay need the VPN boundary.
Use a dedicated transit network between VPN/relay and broker, not the general
backend network. The relay listens only on the hub VPN IP:8883 and forwards raw
TLS to broker:8883; client certificate identity/ACL remains enforced by Mosquitto.
No generic IP forwarding/NAT to backend networks. Site-to-site forwarding denied.
Ingestion reaches MQTT internally; API, database, Keycloak, OpenRemote, frontend
and Portainer do not receive VPN routes. Keep local MQTT loopback access for tests.
Provisioning/OTA is a FUTURE explicit allowlist service, disabled initially; no
blanket SSH, OT subnet or ESP access. WireGuard terminates at each Site Router.

### Prepared artifacts and safety gate

`deploy/wireguard/compose.prepared.yml` is an intentionally non-operational
scaffold: profile, no network, no ports, no capabilities, restart disabled and
an entrypoint that exits. Even explicit service targeting cannot start a tunnel.
Profiles alone are not a safety gate: Docker can start an explicitly targeted
profiled service. The reviewed ARM64 image digest is deliberately not selected
until compatibility verification. Templates contain placeholders, not usable keys.
Hub `Table=off` prevents automatic routes; exact peer /32 routes must later be
installed inside its container namespace. No default routes or whole LAN imports.
All real configuration/keys belong outside Git/synced folders, mode 0600.

### Activation checklist — requires new approval

1. Confirm relocation, Site Router model/WireGuard support, endpoint reachability
   and non-overlapping private addressing. Do not substitute ROCK Pi as peer.
2. Verify Colima Linux kernel WireGuard support and UDP forwarding from the Mac;
   select/pin ARM64 image. Any extra host/router port forwarding needs approval.
3. Generate separate hub/site keys privately, register exact /32 AllowedIPs;
   create deny-by-default IPv4/IPv6 firewall BEFORE bringing up the tunnel.
   Allow only WG UDP and approved ROCK Pi source to VPN MQTT TCP 8883, established
   replies; prohibit forwarding between peers and toward host/backend networks.
4. Implement relay/transit network and explicit namespace routes. Preserve all
   existing Mac/other-container default routes. Issue broker server SAN for its
   approved VPN DNS/IP before testing; current localhost certificate is insufficient.
5. Deploy gateway mTLS identity/ACL securely. Test handshake, actual heartbeat,
   missing/wrong cert and foreign-topic denial, and forbidden peer/backend access.
6. Test restart, loss/recovery, route/firewall persistence and unchanged Mac
   Ethernet/DNS/default route. Then record evidence and update HANDOFF.
7. Rollback: stop/remove only new VPN/relay resources and dedicated attachment;
   preserve MQTT data and all backend volumes. Never use a broad compose down -v.

Not verified: kernel/image, UDP path, live peer, firewall/relay or real heartbeat.
No runtime readiness claim. Preparation is stacked on MQTT PR #22.

## Български

Решение от 2026-09-15: САМО ПОДГОТОВКА. Не активирай преди потвърдено
преместване на ROCK Pi и ново разрешение. Няма промени в работещата среда:
не е свалян image, генериран ключ, стартиран контейнер или отварян порт;
Ethernet, DNS, DHCP и маршрутите/default gateway на Mac не са променяни.

### Планирани граници (не са внедрени)

```text
ROCK Pi -> Site Router == WireGuard == изолиран VPN контейнер
                                           |
                               TCP препращане без TLS терминация
                                           |
                                      MQTT broker
                                           |
                             ingestion -> PostgreSQL/OpenRemote
```

Само VPN контейнерът и отделното MQTT TCP препращане имат нужда от тази граница.
Отделна транзитна мрежа ги свързва с broker-а, не с общата backend мрежа.
Препращането слуша само на VPN IP:8883 и предава TLS към broker:8883; Mosquitto
проверява клиентските сертификати и ACL. Без общо IP forwarding/NAT към backend
мрежите и без Site-to-Site. Ingestion чете MQTT вътрешно; API, базата, Keycloak,
OpenRemote, frontend и Portainer не получават VPN маршрути. Локалният MQTT
loopback достъп остава за тестове. Provisioning/OTA е БЪДЕЩА изрична allowlist
услуга, първоначално изключена; без общ SSH/OT/ESP достъп. Peer е Site Router.

### Шаблони и защита от случайно активиране

`deploy/wireguard/compose.prepared.yml` умишлено не работи като VPN: profile,
без мрежа/портове/capabilities, без restart и entrypoint с отказ. Изричното
стартиране на услугата също не вдига тунел. Само profile не е достатъчна защита,
защото Docker стартира изрично посочена услуга. ARM64 image/digest ще се избере
след проверка за съвместимост. Конфигурациите съдържат placeholders, не ключове.
`Table=off` забранява автоматични маршрути; точните /32 маршрути се добавят
по-късно само в контейнера. Без default route/цели LAN мрежи. Реалните настройки
и ключове остават извън Git/синхронизирани папки, с права 0600.

### Активиране — само след ново разрешение

1. Потвърди преместването, Site Router/WireGuard, endpoint и непресичащи се
   адреси. Не заменяй Site Router с ROCK Pi.
2. Провери kernel WireGuard и UDP през Colima/Mac; избери ARM64 image/digest.
   Допълнителен host/router port forwarding изисква разрешение.
3. Генерирай частни отделни ключове и точни /32 AllowedIPs. Преди тунела
   сложи IPv4/IPv6 firewall с отказ по подразбиране: само WG UDP, одобрен ROCK Pi
   към VPN MQTT 8883 и отговорите. Без препращане между peers или към host/backend.
4. Реализирай TCP/transit мрежата и маршрутите в контейнера, без промяна на Mac
   и останалите контейнери. Издай broker сертификат за VPN DNS/IP; localhost
   сертификатът не е достатъчен за този достъп.
5. Достави gateway mTLS/ACL сигурно; тествай handshake, реален heartbeat,
   отказ при липсващ/грешен сертификат и чужд topic/peer/backend достъп.
6. Тествай рестарт, отпадане/възстановяване, firewall/маршрути и непроменени
   Ethernet/DNS/default route на Mac. Запиши доказателствата в HANDOFF.
7. Rollback само на новите VPN/TCP ресурси и отделната връзка; запази MQTT
   данните и backend volumes. Не използвай общо compose down -v.

Не са проверени kernel/image, UDP, реален peer, firewall/TCP или heartbeat.
Няма твърдение за runtime готовност. Подготовката стъпва върху MQTT PR #22.

## References / Източници

- [WireGuard quickstart](https://www.wireguard.com/quickstart/)
- [Docker profiles](https://docs.docker.com/compose/how-tos/profiles/)
