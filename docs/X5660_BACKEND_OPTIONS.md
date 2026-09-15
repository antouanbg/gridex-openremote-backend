# X5660 backend options / Варианти за backend на X5660

## English

### Decision status — 2026-09-14

The machine is the existing Windows 10 Enterprise HP Z800, not the Mac.
This is research, not an approved architecture replacement or installation.
Windows 11 remains planned production; this host is temporary staging.
No image has passed a real startup test on this machine. No Docker, VM,
network, BIOS or physical-device change was made. Research follows PR #10.

Preferred concept to evaluate: **Windows host → existing Hyper-V → Ubuntu
Server 24.04 amd64 VM → Docker Engine/Compose → the six backend services**.
Keep Manager **1.30.0**, repackage only its runtime. This avoids dependence on
Docker Desktop's Windows support/install mode and Desktop subscription terms;
Engine has its own open-source licensing. It does not fix Windows host servicing
or missing CPU instructions. Ubuntu and Docker must also pass real guest tests.

Microsoft documents Ubuntu 24.04 as a Hyper-V guest; Docker lists it as an Engine
host. Ubuntu's ordinary amd64 baseline does not require AVX2; do not select an
amd64v3 variant. These are documented prerequisites, not an end-to-end certification
of Windows 10 build 19045 on this workstation.

| Option | What changes | Assessment, not a tested result |
|---|---|---|
| Ubuntu VM + Engine | Container host becomes a managed Linux guest; Windows remains | Preferred investigation: explicit service lifecycle, Linux volumes, reproducible backup; still needs Manager rebase and VM maintenance. |
| Desktop + Hyper-V | Retains prior plan | Possible conditional route, still needs OS/licensing gate and Manager rebase; does not solve CPU limits. |
| Linux directly on Z800 | Replaces Windows or uses separately booted storage | Removes Windows servicing/VM overhead, but disrupts workstation use and requires explicit OS/storage approval; CPU limits remain. |
| Native Windows services | Java/Node/PostgreSQL run outside Linux containers | Major operational rewrite of proxy, scripts, filesystem, native libraries and backups; not established as equivalent to the upstream stack. |
| Remove OpenRemote | API/DB plus replacement asset/rules/telemetry services | Product redesign, not an image fix: replaces live Assets, rules, datapoints, Agents and API adapter contracts. No demonstrated need to incur this work yet. |

Proposed initial VM budget: 4 vCPUs, 8 GiB fixed RAM and an 80 GiB dynamically
allocated SSD-backed disk, with host free-space monitoring and separate restore
headroom. This is a starting estimate, not capacity acceptance. Current host had
about 13 GiB free RAM. Recheck storage before allocating; never fill the SSD.

Isolation must preserve PR #10's intent: no external bridge to a Site, no physical
Agents/rules, no MQTT publication, writes locked. Inside the guest publish only
loopback HTTP/HTTPS/API; **guest loopback is not Windows loopback**. For Windows
browser access, a later reviewed management-only connection can forward Windows
127.0.0.1 to guest loopback (e.g. an authenticated SSH local forward with remote
forwarding disabled). Validate listener addresses/issuer/ports end-to-end. Do not
publish the application on the guest LAN to simplify access. Any switch/NAT/SSH
setup needs separate authorization; do not use the physical-device network.

### Evidence and limits

Local .NET CPU probes: SSE2/SSE3/SSSE3/SSE4.1/SSE4.2/POPCNT true; AVX/AVX2 false.
This is Windows process evidence. It is not a full x86-64-v2 certification or a
measurement of the future guest's exposed CPUID flags.

`CPU_IMAGE_METADATA.json` records public OCI amd64 manifest/config identifiers,
selected labels, entrypoint, healthcheck and bounded build-history excerpts.
Only metadata was fetched: no filesystem layer extraction, ELF dependency scan,
image build or execution. Registry labels/history are provenance evidence, not
independent proof of every binary's ISA. Platform digests differ from multiarch
index digests in PR #10. Reconcile and lock both before a build; do not silently
substitute a mutable tag for an earlier digest.

| Service/image | Observed evidence | Remaining proof |
|---|---|---|
| Manager 1.30.0 | Published config identifies UBI 10/OpenJDK 21 and application commit bf6ea01acd63552bfc9eaae07d44d10dd4000424; tagged Dockerfile agrees | UBI 10's x86-64-v3 baseline conflicts with this CPU. This is a documented mismatch, not an observed crash. Rebased image must pass actual startup. |
| Keycloak 26.7.3.0 | Published labels identify RHEL 9; tagged upstream Keycloak 26.7.3 uses ubi9-micro and java-21-openjdk-headless; OpenRemote adds providers and curl | UBI 9 requires v2 rather than v3. Likely candidate, not certified: verify full guest flags, JVM, native providers, DB bootstrap and ready endpoint. |
| OpenRemote PostgreSQL 17.9.0.1-slim | Tagged source derives from timescaledb-ha; published labels report PostgreSQL 17.9, TimescaleDB 2.26.4, Toolkit 1.22.0 and PostGIS 3.6.3; slim process retains native libraries | Exact underlying OS/package ISA is not established by the flattened slim history. Test initdb, real start, extension loading, representative SQL and backup utilities. Do not assume all extensions share baseline ISA. |
| Proxy 3.2.19.0 | Published history uses Alpine 3.24.1; HAProxy 3.2.19; source adds OpenSSL, curl, certbot/Python and Lua support | Alpine baseline is a candidate match. Verify HAProxy/OpenSSL and Python native wheels, TLS generation/handshake, routing and /docker-health. |
| GrideX DB postgres:17.9-alpine | Published history uses Alpine 3.23.4, PG_VERSION=17.9; ordinary docker-entrypoint.sh | Test initdb/start, both migrations, SQL, pg_dump/restore; metadata alone cannot certify native code. |
| GrideX API | main Dockerfile uses mutable node:22-alpine. Current resolved image has Node 22.23.2, Alpine 3.24.1; exact amd64 digest recorded | No built API image exists here. Lock base, npm ci with current lock, verify native addons and run real API. Node 22 musl is Experimental in Node's support table; glibc is a separately reviewed alternative, not an automatic change. |

Correction to earlier wording: there is no dedicated GrideX TimescaleDB service,
but the selected **OpenRemote PostgreSQL image does contain TimescaleDB** according
to its labels/source. An extension's actual installation/activation is untested.

### Manager 1.30.0 repackage candidate

Candidate runtime family: Eclipse Temurin Java 21 JRE on **Ubuntu 24.04 Noble
glibc**, not Alpine/musl or UBI 10. Adoptium lists Java 21 LTS maintenance through
at least December 2029; Ubuntu lists 24.04 standard maintenance through May 2029.
This means upstream maintenance, not a paid support contract or a guarantee for
this custom Manager package.

Verified available candidate: `eclipse-temurin:21.0.12_8-jre-noble`, amd64 digest
`sha256:a167be94ba82d4f8b4cb5071b448281a7c8b01ec22f5e8190b7f31fdcfcfc54f`.
Its config reports Java 21.0.12+8 and Ubuntu 24.04. Adoptium's current source/support
page also mentions 21.0.12.1+1, but the guessed tag `21.0.12.1_1-jre-noble` returned
MANIFEST_UNKNOWN. Do not invent a lock for that newer patch: resolve its published
name/digest and security delta before implementation. The available older patch
is a research candidate, not an approved current patch selection.

The Ubuntu baseline avoids the known UBI 10 ISA floor. Temurin HotSpot is expected
to dispatch instructions according to CPUID, but this exact JRE on this guest is
**an assumption until tested**. Do not force UseAVX=2 or claim UseAVX=0 fixes a
glibc/ELF binary that already requires v3. UBI 9 Java 21 is another candidate, but
its v2 floor and exact current digest must be independently checked.

Preserve application bytes by using the locked official Manager 1.30.0 image as
a **COPY-only build stage**, with no RUN in that stage. Copy `/opt/app/lib`,
`/opt/web`, `/opt/map`, `/entrypoint.sh`, `/heapdump-rename.sh` into the new runtime.
Do not copy `/lib`, `/usr/lib`, the old JVM or loader from UBI 10. Hash every copied
file and compare with the source image; inspect version.properties for 1.30.0.
Retain license/notice files. This is repackaging, not recompilation of the app.
Native libraries embedded in JARs remain a separate gate even when hashes match.

Required packaging work, not implemented here:

- Preserve `/opt/app` workdir and all effective OR_* environment defaults, including
  values inherited from the old base. COPY does not transfer ENV/USER/healthcheck.
  Keep timezone, metrics, classpath, Java options, storage paths and issuer checks.
- Upstream entrypoint uses POSIX sh, date, mv, ls and `exec java`; it does not call
  Red Hat's run-java.sh. Keep its heap-dump rotation and exact classpath
  `/opt/app/lib/*:/deployment/manager/extensions/*:/extensions/*` and Main class.
  Java must remain PID 1; retain JAVA_OPTS and JAVA_OPTS_APPEND expansion semantics.
- Temurin has `/__cacert_entrypoint.sh`; replacing ENTRYPOINT bypasses its CA
  preparation. Decide explicitly whether to chain it to `/entrypoint.sh`, or use
  a pre-provisioned verified Java truststore. Test chosen behavior under the final
  UID; never disable TLS validation to compensate. Keep JAVA_TOOL_OPTIONS behavior.
- Ensure sh/coreutils, curl, CA certificates, timezone data and fontconfig/freetype
  are present; inspect exact dependencies rather than blindly copying UBI RPMs.
  Preserve script executability/LF endings. Verify Java heap flags, writable
  /storage/logs, /storage heap dumps and grant-file location. Upstream config uses
  root; a non-root conversion is a separate change requiring volume-permission tests.
- Native audit: tag dependency catalog lists sqlite-jdbc 3.53.2.0, jSerialComm
  2.11.4 and Netty 4.2.17.Final. Enumerate actual JAR payloads and JNI/shared objects,
  inspect ELF interpreter/DT_NEEDED/GLIBC symbol versions/ISA notes with readelf,
  and test loading on X5660. Include compression, TLS, map/SQLite and other
  transitives actually present. Missing ISA notes do not prove safety. Rebuild
  a failing native dependency for the baseline only as a separately reviewed
  dependency change, not silently as part of a base-image swap.
- Keep Manager HTTP healthcheck `curl --fail --silent http://localhost:8080`
  (5s interval, 60s timeout, 5s start period, 120 retries) for initial parity.
  Ensure curl works in the new runtime. Healthy HTTP is not proof of login,
  migrations, native code paths or absence of device connectivity.

### Required evidence before saying compatible

All items are **NOT RUN**. First verify guest CPU flags, `java -version` and
native loaders with no network. Then test each image's real process with fresh
disposable data and only isolated container dependencies: Keycloak readiness and
login, both DB starts/extension queries, proxy TLS/health, API startup/rights and
Manager 1.30.0 DB/Keycloak boot plus UI login. Exercise JNI/SQLite paths without
physical serial devices; do not add device mounts or control rules. Test restart,
graceful stop, persistence and backup/restore. Record exact source/base/final
digests, guest flags, versions and sanitized results. A test on a newer Mac/CPU
is useful integration evidence but not X5660 compatibility evidence.

## Български

### Статус на решението — 2026-09-14

Машината е наличният Windows 10 Enterprise HP Z800, не Mac. Това е проучване,
не одобрена смяна на архитектурата или инсталация. Windows 11 остава планираният
production; този host е временен staging. Нито един image няма реален startup
тест тук. Няма Docker, VM, network, BIOS или physical-device промени. Следва PR #10.

Предпочитана концепция за проверка: **Windows host → наличен Hyper-V → Ubuntu
Server 24.04 amd64 VM → Docker Engine/Compose → шестте backend услуги**.
Manager остава **1.30.0**, сменя се само runtime пакетът. Отпада зависимостта от
Docker Desktop Windows support/install mode и Desktop абонамента; Engine има
собствен open-source лиценз. Това не решава Windows servicing или липсващите CPU
инструкции. Ubuntu и Docker също трябва да минат реални guest тестове.

Microsoft документира Ubuntu 24.04 като Hyper-V guest; Docker го включва като
Engine host. Обикновеният Ubuntu amd64 baseline не изисква AVX2; без amd64v3
вариант. Това са prerequisites, не цялостен сертификат за този Windows 10 host.

| Вариант | Промяна | Оценка, не тестван резултат |
|---|---|---|
| Ubuntu VM + Engine | Container host става Linux guest; Windows остава | Предпочитано проучване: явен service lifecycle, Linux volumes, възпроизводим backup; нужни Manager rebase и VM поддръжка. |
| Desktop + Hyper-V | Запазва предходния план | Условна възможност с OS/license gate и Manager rebase; не решава CPU лимитите. |
| Linux директно на Z800 | Замяна на Windows или отделно boot storage | Премахва Windows servicing/VM overhead, но променя workstation употребата; изисква OS/storage разрешение; CPU лимитите остават. |
| Native Windows услуги | Java/Node/PostgreSQL извън Linux containers | Значителна преработка на proxy, scripts, filesystem, native libraries и backups; не е доказана еквивалентност с upstream stack. |
| Премахване на OpenRemote | API/DB плюс заместващи asset/rules/telemetry услуги | Product redesign, не image fix: замяна на live Assets, rules, datapoints, Agents и API adapter договорите. Засега няма доказана нужда от този разход. |

Начално предложение: 4 vCPU, 8 GiB фиксирана RAM, динамичен 80 GiB SSD-backed
диск, наблюдение на host free space и отделен резерв за restore. Това е оценка,
не capacity acceptance. Свободната RAM беше около 13 GiB. Проверка на дисковете
преди allocation; SSD не трябва да се запълва.

Запазва се изолацията от PR #10: без external bridge към Обект, physical Agents/
rules, MQTT публикация; writes locked. В guest само loopback HTTP/HTTPS/API;
**guest loopback не е Windows loopback**. За Windows browser достъп бъдеща
прегледана management-only връзка може да forward-ва Windows 127.0.0.1 към guest
loopback, например authenticated SSH local forward с изключен remote forwarding.
Проверка на listeners/issuer/ports. Без application публикация към guest LAN за
удобство. Switch/NAT/SSH изискват отделно разрешение; без device мрежата.

### Доказателства и ограничения

Локални .NET CPU проверки: SSE2/SSE3/SSSE3/SSE4.1/SSE4.2/POPCNT true; AVX/AVX2 false.
Това е Windows process evidence, не пълен v2 сертификат или бъдещ guest CPUID тест.

`CPU_IMAGE_METADATA.json` пази публични OCI amd64 manifest/config identifiers,
избрани labels, entrypoint, healthcheck и ограничени history откъси. Само metadata:
без filesystem layer extraction, ELF scan, build или execution. Labels/history
доказват произход, не ISA на всеки binary. Platform digests са различни от
multiarch index digests в PR #10. Да се съпоставят и фиксират преди build; без
мълчалива подмяна на стар digest с mutable tag.

| Услуга/image | Наблюдавани доказателства | Оставащо доказване |
|---|---|---|
| Manager 1.30.0 | Config: UBI 10/OpenJDK 21, app commit bf6ea01acd63552bfc9eaae07d44d10dd4000424; tagged Dockerfile съвпада | UBI 10 v3 противоречи на CPU. Документирано несъответствие, не наблюдаван crash. Rebase изисква реален startup. |
| Keycloak 26.7.3.0 | Labels: RHEL 9; upstream 26.7.3 използва ubi9-micro/java-21-openjdk-headless; OpenRemote добавя providers/curl | UBI 9 иска v2, не v3. Вероятен кандидат, не сертификат: guest flags, JVM/native providers, DB bootstrap и readiness. |
| OpenRemote PostgreSQL 17.9.0.1-slim | Source: timescaledb-ha; labels: PostgreSQL 17.9, TimescaleDB 2.26.4, Toolkit 1.22.0, PostGIS 3.6.3; slim пази native libraries | Точният OS/package ISA не е установен от flattened history. Initdb, старт, extensions, SQL и backup utilities; extensions може да имат различни изисквания. |
| Proxy 3.2.19.0 | History: Alpine 3.24.1; HAProxy 3.2.19; OpenSSL/curl/certbot/Python/Lua в source | Alpine baseline е кандидат. Проверка на HAProxy/OpenSSL/Python native wheels, TLS generation/handshake, routing и /docker-health. |
| GrideX DB postgres:17.9-alpine | History: Alpine 3.23.4, PG_VERSION=17.9; docker-entrypoint.sh | Initdb/start, двете миграции, SQL, pg_dump/restore; metadata не сертифицира native code. |
| GrideX API | main използва mutable node:22-alpine; текущ image: Node 22.23.2/Alpine 3.24.1; записан точен amd64 digest | Тук няма built API image. Base lock, npm ci, native addons и реален API старт. Node 22 musl е Experimental; glibc е отделна прегледана алтернатива. |

Корекция: няма отделна GrideX TimescaleDB услуга, но избраният **OpenRemote
PostgreSQL image съдържа TimescaleDB** според labels/source. Реалната инсталация/
активация на extension не е тествана.

### Кандидат за Manager 1.30.0 repackage

Eclipse Temurin Java 21 JRE върху **Ubuntu 24.04 Noble glibc**, не Alpine/musl или
UBI 10. Adoptium посочва Java 21 LTS поддръжка поне до декември 2029; Ubuntu 24.04
standard maintenance до май 2029. Това е upstream maintenance, не платен договор
или гаранция за custom Manager пакета.

Проверен наличен кандидат: `eclipse-temurin:21.0.12_8-jre-noble`, amd64 digest
`sha256:a167be94ba82d4f8b4cb5071b448281a7c8b01ec22f5e8190b7f31fdcfcfc54f`.
Config: Java 21.0.12+8/Ubuntu 24.04. Текущите Adoptium source/support споменават
21.0.12.1+1, но предполагаемият tag `21.0.12.1_1-jre-noble` върна MANIFEST_UNKNOWN.
Без измислен lock: да се намерят публикуваните име/digest и security delta преди
реализация. Старият наличен patch е research кандидат, не одобрен current patch.

Ubuntu baseline премахва известния UBI 10 ISA праг. Очаква се Temurin HotSpot да
избира инструкции според CPUID, но точният JRE/guest остава **предположение до тест**.
Без UseAVX=2; UseAVX=0 не поправя glibc/ELF, изискващ v3. UBI 9 Java 21 е друг
кандидат с нужда от отделна проверка на v2 и точния актуален digest.

Запазване на app bytes чрез locked официален Manager 1.30.0 като **COPY-only build
stage**, без RUN в него. Копиране на `/opt/app/lib`, `/opt/web`, `/opt/map`,
`/entrypoint.sh`, `/heapdump-rename.sh` в новия runtime. Без `/lib`, `/usr/lib`,
стария JVM или UBI 10 loader. Hash сравнение на всеки файл със source image;
version.properties трябва да е 1.30.0. Запазване на license/notice. Repackage,
не app recompilation. Native libraries в JARs остават отделно условие.

Необходими промени по пакетирането, още неимплементирани:

- Запазване на `/opt/app` workdir и всички ефективни OR_* defaults, включително
  наследените. COPY не пренася ENV/USER/healthcheck. Запазване на timezone, metrics,
  classpath, Java options, storage и issuer checks.
- Upstream entrypoint използва POSIX sh/date/mv/ls и `exec java`, не Red Hat
  run-java.sh. Запазване на heap rotation, точния classpath
  `/opt/app/lib/*:/deployment/manager/extensions/*:/extensions/*` и Main class.
  Java остава PID 1 със същото JAVA_OPTS/JAVA_OPTS_APPEND expansion поведение.
- Temurin има `/__cacert_entrypoint.sh`; замяната на ENTRYPOINT го пропуска.
  Изрично решение за chaining към `/entrypoint.sh` или предварителен проверен Java
  truststore. Тест под крайния UID; без TLS bypass. Запазване на JAVA_TOOL_OPTIONS.
- Налични sh/coreutils, curl, CA certificates, timezone data, fontconfig/freetype;
  проверка на точните dependencies, не копиране на UBI RPMs. Executable scripts/LF,
  heap flags, writable /storage/logs, heap dumps и grant-file място. Upstream config
  е root; non-root е отделна промяна с volume-permission тестове.
- Native audit: tagged catalog съдържа sqlite-jdbc 3.53.2.0, jSerialComm 2.11.4,
  Netty 4.2.17.Final. Опис на реалните JAR/JNI/shared objects; ELF interpreter,
  DT_NEEDED/GLIBC symbols/ISA notes чрез readelf; loading тест на X5660. Включени
  реалните compression/TLS/map/SQLite и transitives. Липса на ISA notes не доказва
  безопасност. Rebuild на отказваща native dependency е отделна прегледана промяна.
- Запазване на HTTP healthcheck `curl --fail --silent http://localhost:8080`
  (5s interval, 60s timeout, 5s start period, 120 retries) за начална еквивалентност.
  Проверка на curl в runtime. HTTP healthy не доказва login, migrations, native
  paths или липса на device connectivity.

### Преди заключение за съвместимост

Всичко е **НЕИЗПЪЛНЕНО**: guest flags, `java -version`, native loaders без мрежа;
после реален process startup с нови disposable данни и само изолирани dependencies:
Keycloak readiness/login, DB starts/extensions, proxy TLS/health, API startup/rights,
Manager 1.30.0 DB/Keycloak boot и UI login. JNI/SQLite без physical serial devices;
без device mounts/control rules. Restart, graceful stop, persistence, backup/restore.
Запис на точни source/base/final digests, guest flags, версии и резултати без
чувствителни данни. Нов Mac/CPU може да докаже интеграция, не X5660 съвместимост.

## Sources / Източници

- [Ubuntu on Hyper-V](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/supported-ubuntu-virtual-machines-on-hyper-v)
- [Docker Engine Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Ubuntu architecture baselines](https://ubuntu.com/project/docs/how-ubuntu-is-made/concepts/supported-architectures/)
- [Ubuntu lifecycle](https://ubuntu.com/about/release-cycle)
- [Temurin support](https://adoptium.net/support/)
- [Temurin Noble Dockerfile](https://github.com/adoptium/containers/blob/main/21/jre/ubuntu/noble/Dockerfile)
- [Manager source](https://github.com/openremote/openremote/tree/bf6ea01acd63552bfc9eaae07d44d10dd4000424/manager)
- [Dependency catalog](https://github.com/openremote/openremote/blob/bf6ea01acd63552bfc9eaae07d44d10dd4000424/gradle/libs.versions.toml)
- [OpenRemote Keycloak](https://github.com/openremote/keycloak/blob/26.7.3.0/Dockerfile)
- [Keycloak base](https://github.com/keycloak/keycloak/blob/26.7.3/quarkus/container/Dockerfile)
- [OpenRemote PostgreSQL](https://github.com/openremote/postgresql/tree/17.9.0.1)
- [OpenRemote proxy](https://github.com/openremote/proxy/blob/3.2.19.0/Dockerfile)
- [Node support](https://github.com/nodejs/node/blob/v22.x/BUILDING.md)
- [Alpine requirements](https://wiki.alpinelinux.org/wiki/Requirements)
- [UBI 9 v2 requirement](https://access.redhat.com/solutions/7057314)
- [UBI 10 v3](https://developers.redhat.com/articles/2024/01/02/exploring-x86-64-v3-red-hat-enterprise-linux-10)
