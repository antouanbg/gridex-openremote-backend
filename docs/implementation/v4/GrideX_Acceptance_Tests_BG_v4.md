# GrideX v4 — приемателни тестове

Дата: 6 септември 2026 г.
**95 теста; всички NOT_RUN. Това е план, не протокол за успешна инсталация.**

T01–T70 са пренесени и адаптирани от v3 без премахване на API/control/DB
изискванията. T71–T95 проверяват новата router-VPN топология.
Рисковете са в [security review](GrideX_Security_Service_Review_BG_v4.md),
gate дефинициите — в [плана](GrideX_Backend_Deployment_Plan_BG_v4.md).

Първо симулатори и изолиран site. Реални endpoints/оборудване се тестват
само с одобрен scope и инженер. Няма неограничен DoS/load тест на работещ BESS.
OPTIONAL се затваря с NOT_APPLICABLE и причина, не се изтрива от плана.

| ID | Gate | Проверка | Очакван резултат | Рискове | Статус |
|---|---|---|---|---|---|
| T01 | G2 | Студен boot на Windows без login/UI | WireGuard native service и Docker stack са отделно проверени; API/IdP/DB readiness се възстановяват. | R16 | NOT_RUN |
| T02 | G3 | ROCK Pi boot без site router/DHCP/WAN | Локалният controller/RS485 работи в валидиран safe-state; няма WireGuard на Edge или чакане на cloud. | R07,R26 | NOT_RUN |
| T03 | G3 | Липсващ bind address или зает northbound port | Отказът на listener не прекратява controller и не отваря wildcard fallback. | R07 | NOT_RUN |
| T04 | G3 | CONTROL адрес/връзка се появява след offline boot | Само network listener/route се възстановява при нужда; няма restart на safety цикъла или стара команда. | R07,R04 | NOT_RUN |
| T05 | G1 | Manager -> Edge от реалната контейнерна среда | Успешно FC03/FC04 четене; проверени route, source и ACL; само host TCP тест не е достатъчен. | R10 | NOT_RUN |
| T06 | G1 | Northbound достъп през неразрешен WAN/OT интерфейс | Отказ на 1502; vendor port остава само локален OT. | R20,R11 | NOT_RUN |
| T07 | G1 | Компрометиран Edge опитва друг peer/Windows admin | Отказ до други обекти, SMB/RDP/WinRM/SQL/Docker; няма hub transit. | R10,R20 | NOT_RUN |
| T08 | G1 | Missing/invalid/expired/wrong-audience/wrong-issuer JWT | Отказ на всички защитени endpoints, включително /sites и заявки без Origin. | R01,R12 | NOT_RUN |
| T09 | G1 | MQTT node пише чужд Asset/control/Agent | Отказ; нормално разрешената собствена telemetry продължава. | R11 | NOT_RUN |
| T10 | G3 | Спира само site WireGuard | Cloud Modbus и MQTTS отпадат заедно; local loop остава; няма публичен MQTT fallback. | R07,R04,R26 | NOT_RUN |
| T11 | G3 | Загубен EMS heartbeat | Определеният timeout и общ IO/tick budget водят до доказан safe-state; без удължаване за удобство. | R04,R08 | NOT_RUN |
| T12 | G3 | Връщане на VPN след изтекла команда | Няма replay; изисква се нова валидна command transaction/lease. | R04 | NOT_RUN |
| T13 | G1 | MQTT отпада, Modbus/RS485 остава | Източникът се сменя по определени quality/age правила, без двойно броене. | R08 | NOT_RUN |
| T14 | G1 | И двата telemetry източника са остарели | STALE/UNKNOWN; HTTP timestamp не представя старата стойност като live. | R08 | NOT_RUN |
| T15 | G3 | Загуба на BMS/PCS комуникация | Невалидни лимити не се използват; watchdog/fallback са измерени, не симулирани в UI. | R08,R05 | NOT_RUN |
| T16 | G3 | Рестарт на Manager/Docker | Локалната безопасност не зависи от backend restart; reconnect без стари writes. | R04,R07 | NOT_RUN |
| T17 | G2 | WAN NAT смяна, packet loss, jitter и MTU | Контролирано възстановяване, bounded resources; без публичен Modbus workaround. | R06,R20 | NOT_RUN |
| T18 | G2 | Peer revoke след restore на стара конфигурация | Актуалният revocation ledger има предимство; отнетият ключ остава забранен. | R15,R18 | NOT_RUN |
| T19 | G1 | ACME renew и реален TLS reload | HTTPS и MQTTS представят новия валиден сертификат; failure изпраща аларма. | R13 | NOT_RUN |
| T20 | G1 | Разрешена външна проверка на IPv4 и IPv6 | Само одобрената повърхност; няма случайно достъпни management/DB/development услуги. | R20 | NOT_RUN |
| T21 | G4-OPTIONAL | По-късен ROCK Pi MQTT publisher през site router е offline | Няма собствен WG; bounded queue, оригинални timestamps и без натиск върху safety loop. | R08,R17 | NOT_RUN |
| T22 | G1 | Router WG машинен ключ през reboots/updates | Ключът остава постоянен; не се преиздава при reconnect; сесийните ключове се договарят автоматично. | R15,R27 | NOT_RUN |
| T23 | G1 | Два site router-а от един golden image/template | Различни локални private keys; duplicate peer/IP/range се отказва при enrollment. | R15,R21,R27 | NOT_RUN |
| T24 | G1 | Непроверен първоначален enrollment | Няма автоматично одобрение; изисква се trusted fingerprint/site ownership. | R15 | NOT_RUN |
| T25 | G1 | Revoke на активен peer и повторен reboot | Отказ веднага и след reboot; active и persisted state съвпадат; останалите peers остават. | R15 | NOT_RUN |
| T26 | G2 | Server key recovery на чиста машина | Проверен portable encrypted recovery/DPAPI rewrap; никакви private keys в log. | R18 | NOT_RUN |
| T27 | G2 | Сценарий компрометиран server key | Старото доверие се отнема; нов fingerprint се доставя доверено; при нужда safe downtime. | R15,R18 | NOT_RUN |
| T28 | G1 | Secret/address scan на release пакет | Няма реални адреси/inventory/keys в source, diff, bundles, images, ZIP и публични logs. | R19,R15 | NOT_RUN |
| T29 | G1 | Runtime DB role privilege test | Няма SUPERUSER/BYPASSRLS/role creation/schema owner права; миграциите са отделни. | R09 | NOT_RUN |
| T30 | G1 | Cross-tenant заявки и pooled DB connections | Изолацията не зависи само от UI/sub/email; няма пренасяне на tenant context между requests. | R12,R09 | NOT_RUN |
| T31 | G1 | Отрицателна container connectivity матрица | Proxy/API/Manager/worker достигат само нужните DB/API/data endpoints; отказът е наблюдаван. | R10 | NOT_RUN |
| T32 | G1 | Невалидни URI, JSON и прекъснати HTTP requests | 400/413 според договора; процесът остава жив; няма unhandled rejection. | R02 | NOT_RUN |
| T33 | G1 | Бавен upstream и множество допустими requests | Deadlines/rate/concurrency/backpressure работят; паметта и връзките са ограничени. | R02 | NOT_RUN |
| T34 | G3 | Невалиден TTL, полета и spoofed source/actor | Schema validation отказва; identity/source не се определят от свободен клиентски текст. | R03 | NOT_RUN |
| T35 | G3 | Interleaving на Modbus записи между controller ticks | Само committed transaction се прилага; heartbeat не прилага staging snapshot. | R04 | NOT_RUN |
| T36 | G3 | Повторен/стар sequence, wrap и reboot epoch | Определено idempotent/anti-replay поведение; една команда не се прилага повторно. | R04 | NOT_RUN |
| T37 | G3 | Heartbeat продължава, command lease е изтекъл | Старият setpoint не се подновява; нужна е валидна нова lease транзакция. | R04 | NOT_RUN |
| T38 | G3 | Локален meter load и contract limit | Реалният controller прилага site headroom; stale/missing meter има инженерно определен fallback. | R05 | NOT_RUN |
| T39 | G3 | PCS write fail/timeout и недостъпен readback | UNKNOWN/FAULT и аларма; reported zero не се представя като measured zero. | R08 | NOT_RUN |
| T40 | G3 | Директен HTTP/MQTT/WS опит при write lock | Не се заобикаля BFF gate; protected executor/Edge не допуска управляващ запис. | R11 | NOT_RUN |
| T41 | G1/G3 | Роли и MFA за човешки критични действия | Viewer/node не управляват; оператор не редактира safety limits; approval/actor се записват. | R11,R12 | NOT_RUN |
| T42 | G1 | OIDC login/logout/refresh и signing-key rollover | PKCE/issuer/audience/expiry/JWKS работят с вътрешния route, без insecure DNS/TLS обход. | R12,R13 | NOT_RUN |
| T43 | G1 | TLS trust store/CA update на устройствата | Валидната верига работи след update; непознат/грешен сертификат се отказва. | R13,R15 | NOT_RUN |
| T44 | G1 | Отнемане на MQTT/WS identity при установена сесия | Вече установената сесия губи правата си/се прекратява; не се тества само нов login. | R11,R15 | NOT_RUN |
| T45 | G2 | Firmware/OS/config update и rollback | Проверен артефакт, scope/canary; няма unsigned/untrusted script execution. | R14,R19 | NOT_RUN |
| T46 | G1 | Ефективни runtime users/capabilities/mounts/limits | Потвърден least privilege; no docker socket/host secrets; поддържаните images работят. | R14 | NOT_RUN |
| T47 | G1 | Миграции и provisioning два пъти/след частичен отказ | Идемпотентност и schema version; грешният DB target се отказва; няма data loss. | R09,R17 | NOT_RUN |
| T48 | G2 | Пълен restore на изолирана чиста среда | Измерени RPO/RTO; identity/assets/business data се възстановяват; writes първоначално затворени. | R18 | NOT_RUN |
| T49 | G2 | Worker restart по време на business/outbox job | Няма загубено/двойно business действие; retry budget/dead-letter са видими. | R17 | NOT_RUN |
| T50 | G2 | SMTP/webhook provider е недостъпен | Има queue/retry/delivery status и независима аларма; не блокира telemetry/control. | R17 | NOT_RUN |
| T51 | G3 | Clock skew/UTC jump и offline time bootstrap | Command timeout използва monotonic time; TLS/JWT fail closed; local safety не спира. | R04,R13 | NOT_RUN |
| T52 | G3 | PCS/BMS watchdog и прекъснат локален процес | Физически измерено безопасно поведение, одобрено от инженер; не само software flag. | R08 | NOT_RUN |
| T53 | G1/G3 | Audit и sensitive diagnostic output | Actor/decision/command lifecycle могат да се проследят; няма token/private-key/personal leakage. | R03,R19 | NOT_RUN |
| T54 | G1 | Frontend OIDC callback, CSP, XSS и token exposure | Няма secrets в bundle и unsafe rendering; изтекъл/отнет session не управлява. | R19 | NOT_RUN |
| T55 | G4 | Forecasting calibration/validation и model rollback | Walk-forward/site quality/backtest; versioned model; няма директни device credentials. | R17 | NOT_RUN |
| T56 | G4 | Optimiser/15-min schedule, units, timezone/DST | Един executor; ограничен и versioned schedule; unit/time errors не се превръщат в write. | R03,R04,R17 | NOT_RUN |
| T57 | G1 | SBOM/dependency/image advisory scan | Сканирани действителните digests; приложимите опасни findings са отстранени или изрично оценени. | R14 | NOT_RUN |
| T58 | G2 | Пълен диск, DB outage и нарастващи logs | Известяване/retention/backpressure; възстановимост и local safe-state. | R14,R18 | NOT_RUN |
| T59 | G2 | Изключен backend или неговата Internet връзка | Независимият monitor известява; локален зелен dashboard не е единствен наблюдател. | R17,R20 | NOT_RUN |
| T60 | G2/G3 | Rollback на DB/VPN/config след промени | Не възстановява revoked keys, active command queues или old commissioning approval. | R18 | NOT_RUN |
| T61 | G1 | Helper вход с невалидни маршрути/ключове/hooks | Allowlist schema отказва; няма shell injection, arbitrary paths или full-tunnel разширяване. | R15 | NOT_RUN |
| T62 | G1 | Първоначален TLS/IdP/bootstrap от празна среда | Няма circular health/proxy/ACME dependency; provisioning е reproducible и частичен failure е възстановим. | R13,R17 | NOT_RUN |
| T63 | G2 | Симулация на WAN saturation/пълна загуба на cloud | Локално безопасно поведение; известни граници на upstream mitigation, без обещание за пълна наличност. | R20 | NOT_RUN |
| T64 | G1 | Liveness срещу readiness и договорите на двата API | Един schema/response контракт; green process не прикрива offline downstream/неприложени миграции. | R01,R17 | NOT_RUN |
| T65 | G4 | Provider inputs/webhooks и SSRF ограничаване | Само trusted destinations, schema/signature, bounded time/size, timestamp/units; няма arbitrary URL fetch. | R17 | NOT_RUN |
| T66 | G3 | Измерен IO/tick/heartbeat бюджет под товар | Спазени engineering bounds с запас; timeout не се удължава тихомълком, за да скрие дефект. | R04,R06,R08 | NOT_RUN |
| T67 | G3 | Modbus idle/partial frame и service stop | Бавен клиент не задържа listen/stop извън бюджета; active sockets се прекъсват контролирано. | R06 | NOT_RUN |
| T68 | G1 | Secret ACL и достъп от обичайни users/контейнери | WireGuard keys/DB admin secrets не се четат от API/Codex/workspace; protected store е реално проверен. | R15,R14 | NOT_RUN |
| T69 | G4 | Configuration revision: Sent срещу Applied | UI потвърждава Applied само след независимо приложено състояние; HTTP 202 не е достатъчен. | R17,R08 | NOT_RUN |
| T70 | G1/G4 | Tenant права за exports/reports/history/alarms/jobs | Всеки endpoint/subscription/job проверява организация/обект, не само основният /sites. | R01,R12,R17 | NOT_RUN |
| T71 | G1 | End-to-end Manager -> router -> ROCK Pi | FC03/04 от действителния Manager; packet source и reply route доказани без широк bypass. | R29,R10 | NOT_RUN |
| T72 | G1 | Overlap/duplicate CIDR в два peers или с Docker/WSL | Enrollment отказва конфликта преди активиране; съществуващите sites не са засегнати. | R21 | NOT_RUN |
| T73 | G1 | Windows peer routes и router AllowedIPs | Само съответният router /32 + неговите 2 EMS CIDR; router към hub /32; без OT/default routes. | R21 | NOT_RUN |
| T74 | G1 | TELEMETRY device опитва CONTROL TCP 1502 | Отказ на router/L2 границата; нормалният MQTTS остава. | R22 | NOT_RUN |
| T75 | G1 | Подправен hub source от TELEMETRY порт/SSID | Отказ чрез ingress zone и anti-spoof; IP текстът не дава доверие. | R22 | NOT_RUN |
| T76 | G1 | ESP32 към друг ESP32 на същия SSID/switch | Client/port isolation е доказана или одобрена по-тясна необходима политика. | R22 | NOT_RUN |
| T77 | G1 | VLAN trunk/native/access грешки и IPv6 обход | Няма L2 bridge/bypass към CONTROL/клиентска LAN; IPv6 е ограничен. | R22,R20 | NOT_RUN |
| T78 | G1 | Site A променя собствен AllowedIPs и опитва site B | Hub не препраща; локална клиентска конфигурация не е единствената защита. | R23 | NOT_RUN |
| T79 | G1 | Site sources към hub SMB/RDP/WinRM/SQL/web admin | Отказ независимо от web правила на физическия uplink. | R23 | NOT_RUN |
| T80 | G1 | Външен IPv4/IPv6 достъп до MQTT TCP 8883 | Недостъпен; няма NAT/UPnP/broad Compose mapping; частният MQTTS работи. | R24 | NOT_RUN |
| T81 | G1/G2 | WG адрес липсва при Docker ingress boot | Fail-closed; няма wildcard MQTT fallback; има сигнализация и контролирано recovery. | R24,R28 | NOT_RUN |
| T82 | G1 | Compose merge на стари и нови port entries | Ефективният config има един одобрен VPN-only 8883 bind; старият broad entry отсъства. | R24 | NOT_RUN |
| T83 | G1 | Split DNS към hub и грешен DNS/CA/hostname | Правилното име работи; грешното TLS се отказва; няма public fallback. | R25 | NOT_RUN |
| T84 | G1 | ESP time bootstrap/DNS/NTP permissions | Локални услуги работят без произволен internet egress; не се изключва TLS validation. | R25 | NOT_RUN |
| T85 | G3 | Физически site router power off | И двата cloud IP пътя отпадат; RS485/OT и инженерният local safe-state се запазват. | R26 | NOT_RUN |
| T86 | G3 | Router CPU/MQTT burst/jitter под контролиран товар | Bounded resources/heartbeat budget; stale commands не се приемат като нови. | R26,R04 | NOT_RUN |
| T87 | G2 | WG interface destroy/recreate на Windows | VPN-only bindings/routes се възстановяват контролирано; няма публично излагане. | R28 | NOT_RUN |
| T88 | G2 | Студен Windows boot без user login | Отделно доказани WG, Docker engine, containers, certificate и data readiness. | R28,R16 | NOT_RUN |
| T89 | G1 | Откраднат router key revoked на активен site | Нови/активни VPN пътища прекратени; persisted state не възстановява достъпа. | R27 | NOT_RUN |
| T90 | G2 | Restore на стар router/hub backup | Revocation ledger е authoritative; няма duplicate identity или resurrection на peer. | R27,R18 | NOT_RUN |
| T91 | G1 | Site VPN masquerade или неочакван Docker source | Тестът открива source промяната; deployment се блокира до ограничена корекция. | R29 | NOT_RUN |
| T92 | G1 | Cutover от ROCK Pi WG към router WG | Новият routed path работи; старият peer е отнет; ROCK Pi няма активни VPN dependencies. | R30 | NOT_RUN |
| T93 | G1 | Legacy публичен MQTT/old router/WG path след migration | Нито един стар bypass не остава; credentials и mappings са отчетени. | R30 | NOT_RUN |
| T94 | G1/G2 | Добавяне на нов site N | Съществуващите sites запазват ключове/маршрути; N не достига други sites. | R21,R23 | NOT_RUN |
| T95 | G2/G3 | Rollback/частично неуспешна migration | Writes locked; без стар public MQTT/revoked key/active command replay; rescue работи. | R30,R18 | NOT_RUN |

## Отчет за отделен тест

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

Истинските IP/ключове, captures, logs и разрешения се съхраняват частно.
Публичен отчет е анонимизиран. Документна проверка, WG handshake, TCP connect,
Modbus read и физически измерен резултат са различни доказателства.
