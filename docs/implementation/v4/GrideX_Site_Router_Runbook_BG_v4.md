# Шаблон за отделен обект — runbook v4.0

Реални IP/ключове се въвеждат само локално. Този файл не съдържа команди
за конкретна марка рутер, защото моделите и firmware не са потвърдени.
[SOURCES.md](SOURCES.md), S2–S3, S9–S10.

## S0. Приемане на hardware/firmware

Потвърди routed WireGuard с изрични routes, LAN/VLAN firewall, anti-spoofing,
изолиран TELEMETRY SSID/портове, split DNS, NTP/DHCP, backup и поддържани
security updates. „Има VPN client“ само по себе си не е достатъчно:
full-tunnel-only firmware без изолация и selective routes не се приема.

Осигури отделен admin/rescue достъп и защитен backup. Провери switch/AP
trunk/access VLAN настройките; общ неуправляем switch може да заобиколи
разделението. Не използвай публичен WAN remote management, UPnP или DMZ.

## S1. Частен site inventory

Регистрирай site ID, router serial/model/firmware, CONTROL и TELEMETRY
диапазони, VPN host адрес, Edge CONTROL адрес и одобрени devices.
Провери за конфликт с други sites, site WAN, backend LAN, Docker/WSL/VPN.
OT остава отделно зад ROCK Pi и не е в Windows peer AllowedIPs.

Ключът се генерира на рутера. Само провереният публичен ключ се изпраща
за регистрация на hub. Backup, съдържащ private key, е secret.
Копирането на конфигурация на нов рутер изисква нова идентичност.
Няма периодично ръчно WG преиздаване, но има updates и incident revoke.

## S2. Разделяне на зоните

WAN/чужд LAN -> само транспорт на рутера, не bridge към EMS.
CONTROL -> ROCK Pi northbound интерфейс.
TELEMETRY -> ESP32/периферия; клиентите са изолирани един от друг.
OT -> PCS/BMS на втори ROCK Pi NIC, извън router VPN routing.

ROCK Pi CONTROL адресът е стабилен. Default route на CONTROL може да сочи
site router за разрешените услуги; OT няма default gateway. При липса на
router/DHCP локалният Edge цикъл трябва да стартира безопасно независимо.

## S3. WireGuard peer

Концептуалните полета са в `templates/site-router.conf.example`.
Public key на hub се проверява по доверен канал.
Endpoint е `<BACKEND_PUBLIC_ENDPOINT>:51820`, изпълнен през WAN.
AllowedIPs към hub: само `<BACKEND_VPN_IP>/32`.
Установи изрично route към hub VPN адреса през WG. Без общ internet route.

От Windows за този peer са регистрирани router /32 и неговите две EMS мрежи.
Няма SNAT/masquerade върху вътрешния VPN трафик; обратният route е явен.
Обичайният NAT на външния UDP transport не нарушава тази забрана.

`PersistentKeepalive = 25` е начална настройка при NAT, не EMS heartbeat
или срок на ключа. Провери разрешен изходящ UDP и reconnect след NAT change.
Няма входящ EMS port forward при site. CGNAT/мобилен transport се изпитват,
не се приема универсална свързаност без тест.

## S4. Firewall матрица

| Източник | Цел | Правило |
|---|---|---|
| WAN/client LAN | CONTROL, TELEMETRY, router admin | Отказ |
| WG + hub VPN source | ROCK Pi CONTROL TCP 1502 | Allow само към одобрения host |
| TELEMETRY devices | hub VPN IP TCP 8883 | Allow през WG, запазени source IP-и |
| EMS devices | Router DNS/NTP/DHCP | Само необходимите локални services |
| TELEMETRY | CONTROL, OT, router admin | Отказ |
| Site devices | Друг site / backend admin/SQL | Отказ |
| Site devices | Публичен MQTT/друг интернет | Отказ по подразбиране |
| Router control plane | Одобрени DNS/NTP/update и WG endpoint | Ограничено; отделно от client forwarding |
| MANAGEMENT | Router/Edge admin | Само отделно одобрение; не от telemetry |
| Всичко останало | Между зони | Отказ |

Разрешавай обратния трафик на установени одобрени връзки, но не произволни
нови връзки. Match на in-interface/zone **и** source/destination.
Не доверявай пакет с подправен „hub source“, получен от TELEMETRY.
При IPv6 приложи същата политика или изрично недостъпна EMS IPv6 свързаност;
не оставяй bypass през router advertisements/default routes.

## S5. DNS, време, TLS, MQTT

В EMS DNS: `<EMS_TLS_HOSTNAME>` сочи към `<BACKEND_VPN_IP>`.
Устройствата ползват локалните разрешени DNS/NTP. Router upstream е отделно
ограничен. Не прави общ публичен A/AAAA запис с частния backend VPN адрес.
При проблем с DNS/VPN връзката се отказва; не избирай публичен MQTT fallback.

ESP32 използва DNS име, CA trust store, уникален MQTT client ID и собствен
ограничен service credential. Не изключвай TLS hostname/time validation.
Планирай надежден time bootstrap и обновяване на CA/firmware.
Да няма обща споделена MQTT администраторска идентичност за целия site.

## S6. Edge и команден път

OpenRemote -> routed VPN -> ROCK Pi CONTROL TCP 1502 -> валидиран локален
driver/safety -> vendor OT TCP 3200. Unit ID и регистри се вземат от
проверения device договор, не от мрежовата схема.

Няма WG на ROCK Pi, Linux forwarding към OT, L2 bridge или cloud модул,
който заобикаля локалните лимити. Listener се bind-ва към CONTROL адрес;
nonfatal listener recovery и независим local loop остават кодови задачи.
Рутерът не преобразува MQTT в Modbus и не изпълнява BESS стратегии.

## S7. Откази и производителност

При отпадане на рутер/VPN и двата cloud канала отпадат. RS485/OT продължават
според инженерния safe-state; local safety не зависи от router CPU/boot.
Стари telemetry samples са STALE/UNKNOWN; command leases не се удължават
от опит за reconnect. След възстановяване няма автоматичен replay.

Провери MTU, packet loss, jitter, router CPU и queueing с ограничен тест.
MQTT burst/updates не трябва да изяждат бюджета за EMS heartbeat. QoS може
да е проектна мярка, но не е гаранция върху непредвидим WAN.

## S8. Приемане и повторяемост

Първо лаборатория/read-only. Изпълни всички приложими тестове T71–T95 и
свързаните основни T01–T70. Добавяне на site N не променя ключовете и
маршрутите на вече приетите sites. Проверява се отрицателно N -> A/B.
Не се клонират private keys/сертификатни private keys от golden image.

При подмяна: нов router key, старият peer revoked, права/DNS/routes
прегледани. Историята на отнемането е по-нова от backup-а.
Снимки на екрани, QR конфигурации, logs и exports остават частни.

Изпълнението на този runbook не е разрешение за реална мощност.
Физическият commissioning и доказването на безопасността са отделни.
