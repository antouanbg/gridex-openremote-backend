# GrideX v4 — сигурност и пълнота на услугите

Дата: 6 септември 2026 г.
Статус: проектен преглед; **не е penetration test и не удостоверява внедряване**.
Няма достъп до реален Windows/site router/Edge от този пакет.

## 1. Метод и граници

R01–R20 са историческите констатации от предоставения v3 преглед на посочените
в [SOURCES.md](SOURCES.md) commits. Не са повторно валидирани срещу текущия
GitHub main. Те не се отбелязват като отстранени само заради новата мрежа.
R21–R30 са рискове/условия на новата router-VPN топология, не твърдения за
вече извършени атаки.

Оценката по gate не е CVSS. G1 блокира публичен/read-only пилот, G2 — приемане
за работа без оператор, G3 — реално физическо управление, G4 — конкретни
разширени функции. Има остатъчен риск от компрометиран host/router, физически
достъп, supply-chain и upstream outage. Изолацията ограничава последствията,
но не прави цялата система неуязвима.

## 2. Исторически отворени констатации

| ID | Gate | Основание от v3 | Задължително действие/доказателство |
|---|---|---|---|
| R01 | G1 | Старият API връща /sites след формална Bearer проверка | Общ JWT middleware и per-object/tenant ACL; отрицателни тестове |
| R02 | G1 | Некоректни URI/JSON и бавни upstream заявки могат да излязат от защитен handler | Bounded sizes/timeouts/concurrency и обработка на грешки; процесът остава жив |
| R03 | G3 | Schema/TTL/source не са последователно наложени | Fail-closed validation, доверен actor, ограничен TTL/lease |
| R04 | G3 | Heartbeat може да приеме staging command; replay границата е непълна | Atomic commit, separation от heartbeat, epoch/sequence/lease тестове |
| R05 | G3 | SiteLimit е празен в прегледания локален control път | Реални локални meter/contract данни и валидиран stale fallback |
| R06 | G3 | Blocking Modbus client може да задържи обслужване/stop | IO/idle deadlines, bounded buffers, прекъсваеми връзки |
| R07 | G3 | Неуспешен northbound start прекратява Edge преди local loop | Local loop независим; listener retry без wildcard fallback |
| R08 | G3 | Reported applied zero/fresh timestamp не доказва измерено състояние | Requested/sent/acknowledged/measured/UNKNOWN разграничение |
| R09 | G1 | API използва bootstrap POSTGRES_USER при нов deployment | Отделни runtime/migration/admin roles, без app superuser |
| R10 | G1 | Обща DB мрежа и липсващ Manager egress | Сегментация и положителни/отрицателни connectivity тестове |
| R11 | G3 | BFF write lock може да се заобиколи с директни OR/MQTT права | Защита във всеки authoritative executor и Edge; тест на всички канали |
| R12 | G1 | Audience/tenant identity не са напълно fail-closed | Issuer/audience/sub+tenant schema, per-route/per-job ACL |
| R13 | G1 | HAProxy API route/admin isolation не са доказани | Реален hostname routing, TLS, trusted proxy и admin ACL |
| R14 | G1 | Плаващи версии и непроверени runtime права | Проверени digests, SBOM/advisories, ограничения, no Docker socket |
| R15 | G1 | Enrollment/revoke helper е нов административен компонент | Само ограничена локална операция; trusted enrollment; no public admin API |
| R16 | G2 | WG service не доказва boot на Docker Desktop | Студен boot без login, отделно доказани engine/stack readiness |
| R17 | G2/G4 | Шест услуги не реализират целия продукт | Отделни jobs/provisioning/notification/forecast/backup задачи с тестове |
| R18 | G2 | Restore може да върне revoked trust/стар command state | Trust ledger precedence, safe locked restore и измерен RPO/RTO |
| R19 | G1 | Portal/build/CI/third-party deps са trust boundary | Secret/build checks, CSP/token hygiene, signed/approved artifacts |
| R20 | G1/G2 | IPv6, DDoS, physical access не са изчерпани от VPN | Отрицателни мрежови тестове, updates/rescue/availability план |

Статус на всеки от R01–R20: **OPEN — REVALIDATE_ON_CURRENT_CODE**.
Мрежовата промяна намалява конкретния wg0 bind сценарий на R07, но не отменя
проблема с липсващ CONTROL адрес или зает port.

## 3. Нови рискове от router-VPN топологията

| ID | Gate | Риск | Необходимо ограничение и приемане |
|---|---|---|---|
| R21 | G1 | Припокриващи се site/Docker/WSL ranges; неправилен peer route | Reject на overlap; per-peer /32 + 2 CIDR; T72/T73/T94 |
| R22 | G1/G3 | ESP32 и Edge в общ L2 позволяват обход на router ACL | CONTROL/TELEMETRY VLAN/port isolation, anti-spoof; T74–T77 |
| R23 | G1 | Windows transit или broad interface allowances дават достъп към друг site/admin | Forwarding disabled за hub, липса на bridge/ICS и negative tests; T78/T79 |
| R24 | G1 | Стар публичен MQTTS/Compose mapping остава активен | Конкретен VPN host bind, премахнат NAT/UPnP/широки rules; T80–T82 |
| R25 | G1 | Split DNS/TLS/time проблем води до публичен fallback или изключено TLS | Fail-closed DNS/CA/hostname/time, router-only DNS/NTP; T83/T84 |
| R26 | G2/G3 | Router/VPN е обща точка на отказ за Modbus и MQTT | Няма обещание за independent cloud path; local safety и stale данни; T85/T86 |
| R27 | G1/G2 | Откраднат/клониран router key дава достъп като целия site | Уникален ключ, private backup, active+persistent revoke, MQTT ACL; T89/T90 |
| R28 | G2 | Restart на Windows/WG губи IP, bind или routes без оператор | Startup ordering, fail-closed binding, recovery test; T81/T87/T88 |
| R29 | G1/G3 | VPN masquerade скрива source; Docker source различен от очаквания | Без site SNAT, измерен source, никакво blanket AllowedIPs разширяване; T71/T91 |
| R30 | G1/G3 | Непълна миграция/rollback възстановява стар peer/public MQTT/стар dispatch | Read-only canary, отнемане на старите пътища, безопасен rollback; T92/T93/T95 |

Статус на R21–R30: **OPEN — DESIGN_CONTROL_NOT_YET_TESTED**.

## 4. Специфични ограничения, които не бива да се пропускат

Един router peer удостоверява рутера и позволените source prefixes, не отделните
устройства зад него. Компрометиран рутер може да се представи за устройства в
своите разрешени мрежи. Пер-device MQTT credentials и asset ACL остават нужни.
След compromise се отнема site peer и се оценяват device credentials/firmware.

Site клиент може да промени собствените AllowedIPs. Следователно изолацията
между sites трябва да е доказана на hub и firewall, не само в клиентския файл.

Нативен Windows firewall scope за Docker backend процеса не е доказана
пер-контейнерна изолация. Proxy/API compromise трябва да се оценява отделно.
Не се дава произволен route до devices на всички application workers.

Наличието на router не заменя IP филтъра на Edge или неговите локални safety
проверки. Modbus в локален LAN не придобива криптографска автентикация сам по
себе си; VLAN/host ACL ограничават доверената LAN повърхност.

CGNAT, MTU и WAN latency се проверяват. Ключ без срок не премахва updates,
revocation и monitoring. Няма public device/control fallback при VPN outage.

## 5. Матрица за пълнота на услугите

| Компонент/функция | Приемателен резултат |
|---|---|
| WireGuard Windows + site peers | Key store, active/persistent state, routes, revoke/restore |
| Site VLAN/DHCP/DNS/NTP | Отрицателна изолация, адресен lifecycle, TLS time bootstrap |
| HAProxy + ACME | API routing, VPN-only MQTT, реален renew/reload, admin restrictions |
| Keycloak/OIDC | Realm/client provisioning, PKCE, token claims, role/asset ACL, session revoke |
| OpenRemote | Assets/agents/history/rules, ограничен executor, quality/age, command leases |
| GrideX API | Един договор, истински auth/tenancy, deadlines/rate limits/audit |
| Двете PostgreSQL | Migration versions, least-privilege, отделен backup и restore |
| Device MQTT | Уникален client ID, own-asset telemetry, TLS trust, stale/fallback policy |
| Edge local control | Safe boot, bounded IO, BMS/site limits, readback, local watchdog |
| Worker/notifications | Queue/retry budget/outbox, видим failed delivery, без control bypass |
| Мониторинг | Независимо известяване при паднал host, не само локален dashboard |
| CI/build/updates | Проверени артефакти, dependency scan, secret-free logs, canary rollback |
| Forecasting/optimiser | По-късен gate; проверени data/units/time, без device credentials |
| Human operations | MFA/admin segregation, private inventory, rescue/change/incident процедури |

Не всички редове изискват нов контейнер. Необходимо е всяка функция да има
собственик, реализирана процедура и тест. Сертификати, миграции и backup не
се появяват автоматично от шесткомпонентния Compose.

## 6. Доказване и решение за пускане

Статичен преглед, WG handshake, TCP connect, HTTP health, Modbus read,
command acknowledgment и физически measured result са различни доказателства.
Не се заменят едно с друго. [Приемателните тестове](GrideX_Acceptance_Tests_BG_v4.md)
остават NOT_RUN до реално изпълнение.

Release: G0 е разрешен за изолирана разработка. G1/G2/G3/G4 се приемат само
след съответните корекции и доказателства, не след документационния PR.
Няма твърдение за „никакъв пропуск/никаква уязвимост“.
