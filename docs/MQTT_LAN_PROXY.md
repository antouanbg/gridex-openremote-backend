# MQTT LAN TCP proxy / MQTT LAN TCP proxy

## English (canonical)

Owner approved the test Site TCP ingress on 8883, without Ethernet changes.
The Mac user LaunchAgent `tech.gridex.mqtt-lan-proxy` relays opaque TCP bytes
from one explicit private LAN IPv4 address to the existing Colima-forwarded
`127.0.0.1:8883`. TLS terminates at the existing Mosquitto broker, not the relay.
There is no HTTP, WebSocket conversion, PROXY protocol, second broker, routing
change or new client identity. Broker certificate authentication and exact
topic ACLs remain authoritative. Broker logs see the relay, not the original IP.

Two settings belong ONLY in the existing private backend `.env` (0600):

```dotenv
GRIDEX_MQTT_PROXY_BIND=192.168.50.10
GRIDEX_MQTT_PROXY_ALLOWED_IPS=192.168.50.20,192.168.50.10
```

Example addresses only: use the actual existing Mac LAN address, approved ROCK
source address and Mac self-test address. No wildcard/public bind or CIDR is
accepted. At most 16 sessions, 5-second upstream connection timeout, 120-second
idle timeout; MQTT keepalive must be shorter. Socket piping applies backpressure.
Denied source addresses are rejected before broker connection. This IP check
does not replace mTLS. It is a LAN test restriction, not an Internet deployment.

Preparation (Mac; reviewed host addresses as arguments):

```sh
node scripts/prepare-mqtt-lan-proxy.mjs MAC_LAN_IP ROCK_IP,MAC_LAN_IP
docker --context colima-gridex kill --signal HUP gridex-mqtt-broker-1
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/tech.gridex.mqtt-lan-proxy.plist"
node --test scripts/mqtt-tcp-proxy.test.mjs
node scripts/test-mqtt-lan-proxy.mjs
```

Preparation saves a private rollback snapshot, updates only these two env
settings, copies the relay outside synced folders, and generates a LaunchAgent.
The server certificate is reissued for 90 days using the SAME existing server
key and CA, preserving localhost/broker SANs and adding the LAN IP SAN. Client
certificates/keys, CA, inventory and ACLs are not changed. This helper is scoped
to the original local staging certificate; do not use for a production certificate
with additional SANs. It does not automate renewal. No TLS verification bypass.
Mosquitto reloads certificate files on SIGHUP ([official documentation](https://mosquitto.org/man/mosquitto-conf-5.html)).

The LaunchAgent starts at user login, retries if its LAN address is unavailable,
and needs the existing Colima/Docker startup. It is not a pre-login system daemon.
For an already loaded agent, bootout it before bootstrap. Rollback: bootout
`gui/$(id -u)/tech.gridex.mqtt-lan-proxy`, move its plist out of LaunchAgents,
restore ONLY the previous server certificate and these two settings from the
reported private snapshot (do not overwrite intervening unrelated env changes),
then SIGHUP the broker. Existing broker loopback operation remains available.

### Acceptance on 2026-09-19

- DEPLOYED: LAN-only listener and persistent user LaunchAgent; broker healthy.
- PASS: six relay tests (byte preservation, invalid configuration, source deny,
  idle timeout, session limit, upstream refusal).
- PASS: real synthetic mTLS through LAN address; missing certificate and wrong
  hostname refused; own-topic delivery; cross-Site and reader writes refused.
  Test records are non-retained under synthetic `lab-a`, not real device health.
- UNPROVEN: packets/session from the physical ROCK. Existing broker inventory
  contains only synthetic lab identities. Imported ROCK configuration did not
  expose MQTT endpoint/certificate identity fields in the inspected whitelist.
  Do not reuse lab identities as real Site credentials or claim provisioning done.
- NEXT: reconcile the real ROCK certificate public identity/issuer and topic
  binding with the existing registered Site, authorize exact topics without
  replacing its keys; apply the verified broker endpoint through configuration.
  Then prove live ROCK health and ESP contact separately via the ingestion worker.
- STILL PENDING: migration 007, worker deployment, actual ROCK version/receipt,
  browser heartbeat acceptance, certificate renewal, external direct-mTLS and VPN.
- AUTH regression: local master/discovery/login-form checks pass. Public auth
  hostname forced to local HTTPS proxy has trusted TLS/200 discovery and four
  protected routes return 404. Normal-DNS public path from Mac times out; external
  access is NOT verified. No HTTPS configuration was changed. This is not browser
  login/logout/session-expiry acceptance.

## Български

Одобреният тестов вход е TCP 8883 без Ethernet промени. Mac user LaunchAgent
`tech.gridex.mqtt-lan-proxy` препраща непроменени байтове от един конкретен LAN
IPv4 към съществуващия Colima `127.0.0.1:8883`. TLS завършва в Mosquitto, не в
proxy-то. Няма HTTP/WebSocket преобразуване, PROXY protocol, втори broker,
маршрутизация или нова клиентска идентичност. mTLS и точните topic ACL остават
задължителни; broker логът вижда proxy-то, а не оригиналния IP.

Само двата ключа от примера по-горе се поддържат в единния частен backend `.env`
(0600). Адресите са примерни: задават се текущият Mac LAN адрес, одобреният ROCK
адрес и Mac адресът за самопроверка. Няма wildcard/public bind или CIDR. Лимит:
16 сесии, 5 секунди за upstream свързване, 120 секунди без трафик; MQTT keepalive
трябва да е по-кратък. Има backpressure. Неодобрени източници се отказват преди
broker връзката. IP ограничението не заменя mTLS и не е публично внедряване.

Командите по-горе подготвят частен rollback, обновяват само двата env ключа,
копират relay извън синхронизирани папки и генерират LaunchAgent. Преиздава се
само server сертификатът за 90 дни със СЪЩИТЕ server key/CA, запазени localhost/
broker SAN и добавен LAN IP SAN. Клиентски сертификати/ключове, CA, inventory и
ACL не се променят. Скриптът е само за първоначалния staging сертификат, не за
production сертификати с допълнителни SAN. Няма автоматично подновяване или
изключване на TLS проверка. Mosquitto презарежда сертификата при SIGHUP.

LaunchAgent стартира при вход на потребителя, опитва отново при липсващ LAN адрес
и зависи от текущия Colima/Docker autostart; не е pre-login system daemon.
При вече зареден agent: bootout преди bootstrap. Rollback: bootout на горния
label, преместване на plist извън LaunchAgents, възстановяване само на предишния
server сертификат и двата env ключа от частния snapshot, после SIGHUP. Не се
презаписват по-нови несвързани env настройки. Loopback broker остава наличен.

Приемане 2026-09-19: LAN listener и user LaunchAgent са внедрени; broker healthy.
6 relay теста минават: байтове, невалидна конфигурация, source deny, timeout,
лимит и отказ на upstream. Реален синтетичен LAN mTLS тест минава: липсващ
сертификат/грешно име се отказват, собствен topic се доставя, чужд topic и reader
запис се отказват. Non-retained `lab-a` данните не са физическа телеметрия.

НЕ Е ДОКАЗАНА сесия от физическия ROCK. Broker inventory съдържа само лабораторни
идентичности; проверените MQTT endpoint/certificate полета липсват в whitelist
на внесената конфигурация. Не приписваме lab сертификат на реалния Обект.
Следва съпоставяне на публичната ROCK certificate identity/issuer и topic binding
със съществуващия Обект, точни ACL без подмяна на ключове и прилагане на endpoint
през конфигурацията. После доказваме ROCK heartbeat и ESP контакт през worker.
Остават миграция 007, worker, реална ROCK версия/доставка, browser приемане,
подновяване на сертификата, Internet mTLS и VPN.

Auth проверка: local master/discovery/login форма минават; public hostname към
локалния HTTPS proxy има доверен TLS/200 discovery и 404 за четири защитени
маршрута. Normal-DNS публичният път от Mac е timeout; външен достъп НЕ е доказан.
HTTPS настройките не са променяни. Това не е browser login/logout/expiry тест.
