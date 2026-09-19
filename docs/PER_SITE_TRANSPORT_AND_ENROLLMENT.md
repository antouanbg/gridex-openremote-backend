# Per-Site transport, enrolment and OTA execution plan

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## English — approved decision, 2026-09-19

The owner explicitly authorizes implementation and publication of BOTH modes,
selected per Site. This supersedes the old blanket VPN-only/public-MQTT ban
only for the controlled direct-mTLS gateway ingress described here. It does
not authorize public OT access, unprotected MQTT, routing all containers through
VPN, battery writes or bypassing commissioning tests. This commit records the
decision and work; it does not enable a listener or deploy a transport selector.

| Configuration value | Path |
| --- | --- |
| `wireguard_private` | ROCK → Site Router → WireGuard → private MQTT |
| `mqtt_mtls_direct` | ROCK → Internet → dedicated authenticated MQTT TLS ingress |

One active mode per ROCK, selected by the Site's approved configuration. No
silent VPN-to-public fallback or concurrent duplicate publishing. MQTT topics,
Site ownership, payload schema, freshness rules and read permissions are the
same in both modes. Use mTLS per ROCK and exact-topic ACLs in BOTH modes; VPN is
not a replacement for application identity. ESP communicates only with ROCK.
Site Router remains the WireGuard peer, never ESP or ROCK.

### Configuration and UI contract

Add a connectivity subsection inside existing Site/Devices settings, not a new
navigation item. Verified Site administrators choose the mode and approve an
immutable revision. Expose desired/applied revision, state, last acknowledgement
and failure reason, never private keys. Lifecycle: draft → approved → pending →
applying → verifying → active / failed / unconfirmed. A saved draft or downloaded
job is not activation. User-visible labels and docs must have matching EN/BG.

Deployment settings stay in the ONE protected backend `.env`; Site selections
and versioned desired state belong in the database, not manually duplicated env
files. ROCK applies generated protected configuration atomically, with rollback
metadata; secrets remain separate protected artifacts. No settings in ad-hoc
commands or source code. Existing enrolled test devices must not be re-enrolled.

### Ordered, independently verifiable work

All items below are **TODO**, not deployment claims. Record commit, environment,
test result and remaining blocker for each; close only on the acceptance evidence.

1. **Backend + Edge + UI: versioned contract.** Define transport enum, approved
   endpoints, certificate identity, revision/job IDs and idempotent receipt.
   Accept: schema tests reject unknown modes, foreign Sites and client-supplied
   ownership; existing configurations migrate without inventing a selected mode.
2. **Backend: persistence and permissions.** Add additive/backed-up migrations
   for connectivity desired/applied state and job audit; apply heartbeat migration
   007 separately. Accept: real PostgreSQL tests, duplicate approval/retry handling,
   administrator-only change and cross-Site read/write denial.
3. **Backend: existing broker and worker.** Reuse Mosquitto, no extra broker just
   for the second transport. Separate controlled ingress paths feed the same
   scoped worker and persistent heartbeat model. Accept: actual ROCK receipt and
   separate ESP last-success time; old/replayed packets cannot revive a device.
4. **Infrastructure: two secure paths.** Private path through Site Router VPN;
   direct path through dedicated MQTT/TLS listener or L4 TCP passthrough to broker.
   Preserve client certificate validation and hostname checks. HTTPS proxying alone
   is not native MQTT; WSS/443 is not promised without tested publisher support.
   Accept: permitted client connects on each path, anonymous/wrong/expired/revoked
   identity denied, foreign topics denied, no public admin/DB/ESP/OT access, bounded
   connection/message rates and verified external TLS. Pin and review ingress
   ports/firewall destinations before enabling; no unrelated Mac route changes.
5. **Backend + Edge: certificate lifecycle.** Unique ROCK key pair generated on
   device, scoped issuance, rotation, expiry alerts and effective revocation.
   Accept: renewal without shared keys; revocation terminates/blocks access, lost
   device recovery is audited. Signing/CA private keys never leave their authority.
6. **Edge + backend: first-boot enrolment.** Image includes journal ownership and
   preflight fixes, no cloned customer identities/secrets. Admin creates short-lived,
   single-use claim scoped to Site; operator supplies it locally to ROCK. ROCK
   generates key and initiates HTTPS enrolment, then receives approved config/cert.
   Accept: replay/expired/stolen-code mitigations, explicit admin confirmation of
   device binding, secret redaction, interrupted enrolment recovery, reboot tests.
   Bootstrap HTTPS access must exist before VPN enrolment; provision router peer
   separately. SSH is not a runtime/provisioning protocol dependency.
7. **Edge: approved mode application.** ROCK initiates outbound job/config checks;
   MQTT is notification, durable backend queue is truth. Preflight selected path,
   atomically apply, verify delivery, acknowledge exact revision; bounded rollback
   to last approved configuration on failure. Accept: interruption, stale/replayed
   job, network loss and reboot tests; no silent downgrade or battery commands.
8. **Frontend: Site selection and device status.** Existing settings host selector,
   explicit approval and application progress. Devices shows separate ROCK backend
   receipt and ESP successful contact; unknown is not online/zero. Accept: populated,
   empty, denied, unavailable, stale and failed-change browser flows in EN/BG.
9. **Backend + Edge: firmware distribution.** Versioned signed manifest binds
   hardware model, firmware version, image hash/size and compatibility. Download
   authorized image over HTTPS; MQTT carries job notification/status, not firmware.
   Accept: bad signature/hash/model/size and replay/downgrade rejected; signing-key
   rotation and version rollback policy documented. Hash alone is not authenticity.
10. **Edge + UI: ESP OTA through ROCK.** Admin approves exact target/version; ROCK
    downloads/verifies and uses local authenticated ESP OTA endpoint. Verify booted
    version and recovered heartbeat, then report success/failed/unconfirmed.
    Accept: both transports, reconnect/reboot/lost-ack, staged rollout and a physical
    test; automatic firmware rollback only for hardware/bootloader proven to support
    it. No public ESP listener or inbound backend connection to the Site.
11. **Operations: fleet lifecycle.** Automate Site Router peers for VPN mode, certs,
    inventory and offboarding for both; enforce no Site-to-Site access. Capacity
    test at least 1001 simulated Sites, reconnect storm, queue bounds, backup/restore
    and hub/broker outage recovery. Do not infer capacity from peer count alone.
12. **Release acceptance.** One approved test Site on each mode, end-to-end heartbeat,
    controlled mode switch and ESP OTA with writes locked, owner browser acceptance,
    documented rollback and monitoring. Publish tested configuration/revisions only;
    preserve current login, menus and backend single-config rule.

### Baseline and next action

Heartbeat code is merged (backend #26/#27, frontend #29, Edge #16/#17) but this
does not prove deployed worker, migration or physical MQTT delivery. The transport
selector, automated ROCK claims and full website-driven OTA are not implemented.
Next: item 1, then 2–3; assess actual deployed state before making runtime changes.

## Български — одобрено решение, 2026-09-19

Собственикът изрично разрешава реализация и публикуване на ДВАТА режима с избор
за Обект. Това отменя старото общо VPN-only/public-MQTT ограничение само за
контролирания direct-mTLS вход. Не разрешава публичен OT достъп, незащитен MQTT,
VPN за всички контейнери, battery writes или пропускане на commissioning тестове.
Този commit записва решението и задачите; не включва listener или работещ selector.

| Стойност | Път |
| --- | --- |
| `wireguard_private` | ROCK → рутер на Обекта → WireGuard → частен MQTT |
| `mqtt_mtls_direct` | ROCK → Интернет → отделен удостоверен MQTT TLS вход |

Един активен режим на ROCK според одобрената конфигурация на Обекта. Без скрит
fallback VPN→public или едновременно дублирано изпращане. Topics, собственост,
payload, freshness и права са еднакви. И в ДВАТА режима: отделен mTLS сертификат
на ROCK и точни topic ACL; VPN не заменя идентичността. ESP работи само през ROCK.
WireGuard peer е рутерът на Обекта, не ROCK или ESP.

### Конфигурация и UI

Подраздел за свързаност вътре в съществуващите настройки Обект/Устройства, без нов
елемент в менюто. Verified Site admin избира и одобрява неизменяема ревизия.
Показват се desired/applied версия, статус, потвърждение и причина за грешка,
никога private keys. Състояния: чернова → одобрена → чакаща → прилагане → проверка
→ активна / неуспешна / непотвърдена. Запис/изтегляне не е активиране. EN/BG
етикетите и документите са смислово еднакви.

Deployment настройките са в ЕДИННИЯ защитен backend `.env`; изборът за Обект и
versioned desired state са в базата, не в дублирани ръчни env файлове. ROCK прилага
защитен генериран config атомично с rollback metadata, тайните са отделни защитени
артефакти. Без ad-hoc настройки в команди/код. Тестовите устройства не се регистрират
повторно.

### Подредени проверими задачи

Всички са **TODO**, не доказано внедряване. За всяка се записват commit, среда,
резултат и пречка; приключване само с доказателство за приемане.

1. **Backend/Edge/UI договор:** transport enum, endpoints, cert identity, revision/
   job ID и idempotent receipt. Тестове за неизвестен режим, чужд Обект/собственост;
   миграцията не измисля режим за съществуващите конфигурации.
2. **Backend база/права:** additive миграции с backup за desired/applied и audit;
   heartbeat 007 отделно. Реални PostgreSQL тестове, повторно одобрение/retry,
   промени само от admin и cross-Site отказ за четене/запис.
3. **Съществуващ broker/worker:** използва се Mosquitto, не нов broker за втория
   транспорт. Двата контролирани входа подават към един scoped worker/heartbeat
   модел. Приемане: реален ROCK receipt и отделно ESP време; replay не съживява.
4. **Двата пътя:** VPN през рутера; direct MQTT/TLS listener или L4 passthrough към
   broker. Запазени client cert и hostname проверки. HTTPS proxy не е native MQTT;
   WSS/443 не се обещава без тест на publisher. Приемане: позволен клиент и по двата
   пътя, отказ за anonymous/грешен/изтекъл/отнет сертификат и чужди topics; без public
   admin/DB/ESP/OT, rate/connection/message ограничения и външен TLS тест. Преглед
   на портове/firewall преди активиране, без несвързани Mac маршрутни промени.
5. **Сертификати:** уникален ключ, генериран на ROCK, scoped issuance, подновяване,
   expiry сигнали и реално отнемане. Проверки за renewal, прекратен достъп при
   revocation и audit при загубено устройство. CA/signing ключовете не напускат
   органа, който ги управлява.
6. **Първи старт:** имидж с journal права/preflight, без клонирани тайни/идентичности.
   Admin създава краткосрочен еднократен Site claim; въвежда се локално в ROCK.
   ROCK генерира ключ и започва HTTPS регистрация, получава одобрен config/cert.
   Тестове за replay/expiry/кражба на кода, admin потвърждение на обвързването,
   скриване на тайни, прекъсване/reboot. Bootstrap HTTPS преди VPN; рутерът се
   провизира отделно. SSH не е зависимост на работния provisioning протокол.
7. **Прилагане:** ROCK започва outbound проверките; MQTT известява, durable queue
   е източникът за задачи. Preflight, атомично прилагане, доказана доставка и
   receipt за точната ревизия; ограничен rollback към последния одобрен config.
   Тестове при прекъсване, replay/стар job, загуба на мрежа/reboot; без downgrade
   или команди към батерия.
8. **Frontend:** selector, одобрение и progress вътре в текущите настройки.
   Отделни ROCK receipt/ESP контакт; unknown не е online/нула. Browser тестове
   populated/empty/denied/unavailable/stale/failed change в EN/BG.
9. **Firmware:** подписан versioned manifest за модел, версия, hash/size и
   съвместимост. Файл по удостоверен HTTPS, MQTT само известия/статус. Отказ за
   грешен подпис/hash/model/size/replay/downgrade; signing rotation и rollback
   политика. Сам hash не доказва произхода.
10. **ESP OTA:** admin одобрява target/version; ROCK проверява файла и прилага през
    локалния удостоверен OTA endpoint. Проверява версията и heartbeat след boot,
    отчита success/failed/unconfirmed. Тест на двата транспорта, reconnect/reboot/
    lost-ack, поетапно rollout и физическа проверка. Автоматичен firmware rollback
    само при доказана hardware/bootloader поддръжка. Без публичен ESP или inbound
    backend достъп до Обекта.
11. **Мащаб:** автоматизирани router peers за VPN, certs/inventory/offboarding и за
    двата режима, без Site-to-Site достъп. Поне 1001 симулирани Обекта, reconnect
    storm, ограничени опашки, backup/restore и hub/broker recovery. Капацитетът
    не се доказва само от броя peers.
12. **Приемане:** тестов Обект на всеки режим, реален heartbeat, контролирана смяна
    и ESP OTA със заключени writes, owner browser, rollback и monitoring. Публикуват
    се тествани ревизии; пазят се входът, менюто и единният backend config.

### Основа и следващо

Heartbeat кодът е слят (backend #26/#27, frontend #29, Edge #16/#17), но това не
доказва worker/миграция/реална MQTT доставка. Selector, автоматични ROCK claims и
целият website OTA поток не са реализирани. Следва т.1, после 2–3; проверка на
реално внедреното състояние преди runtime промени.
