# Handoff — GrideX OpenRemote backend

Repository / GitHub: `antouanbg/gridex-openremote-backend`

## English

### DHCP follow-up pending

VM attach and normal restart succeeded with 22 uniquely weighted ACLs. No DHCP
address or SSH success has been observed. Prepared a DHCP-only reply exception
(UDP server 67 to client 68 on the internal Default Switch) because the service
may not source replies from the host interface address. Its elevated application
is awaiting completion; do not claim DHCP/SSH/Docker ready. Other ACLs unchanged.


### Live repair: VM running, DHCP still pending

Administrator inspection confirmed gridex-auto running with its prepared disk
and seed, but a disconnected NIC. Fixed two provisioning defects: expected ACL
count was 23 instead of 22; repeated direction/weight pairs caused switch attach
to fail with 0x800700B7. Unique priorities preserved all restrictions. Actual
attach succeeded, then the new VM was shut down normally and started again.
DHCP/SSH/Docker acceptance remains pending. Regression construction check passed:
22 rules with unique direction/weight pairs. Do not rerun the creation launcher
against the existing VM. No physical devices contacted; old VM preserved.


### Latest: automatic VM prepared

User replaced manual console work with a ready automated VM request after a
reported freeze/reboot. See docs/AUTOMATED_CLOUD_VM.md. Generic cloud QCOW
checksum/signature, VHD full-data roundtrip and seed ISO/YAML checks PASS.
Start-GrideX.cmd is the single UAC launcher; old VM session is saved, not deleted.
New VM/DHCP/SSH/ACL/Docker/image runtime remain NOT_RUN. Six application services
are not deployed yet; OIDC, migrations and acceptance remain pending. Branch
codex/automated-cloud-vm follows PR #12. Keys/artifacts are local only.


### Current checkpoint — Ubuntu running; offline SSH preparation

User evidence: Ubuntu installed, rebooted and logged in; uname reports x86_64.
User configured an internal staging switch and temporary guest IPv4; ping to
Windows reportedly succeeds. No NAT/default route configured. SSH service is
absent; APT failed DNS. Read the verified ISO archive/package index: SSH server,
SFTP server, libwrap0 and ncurses-term are present. Next: reattach ISO and use
APT CD-ROM as documented in docs/OFFLINE_SSH_BOOTSTRAP.md. Dependency resolution
and SSH startup remain untested. Docker/Manager 1.30.0 and all acceptance tests
remain pending. Addresses, screenshots and keys are not committed. PR #12.

### Latest unattended result — ISO verified; VM creation blocked

User authorized waiting and continuing while away. Ubuntu Server 24.04.5 ISO
finished downloading; Get-UbuntuIso.ps1 returned Checksum=PASS and exit 0.
SHA256: 97f3d7ffb032c3eb3b23d2c8be9cc76e60c2c1f2c0146ba5ba9fe01cafae0fd8.
Separately verified SHA256SUMS.gpg with existing Git GnuPG: VALIDSIG fingerprint
843938DF228D22F7B3742BC0D94AA3F0EFE21092 matches Ubuntu's published fingerprint.
The download script's Signature=NOT_VERIFIED describes that script only; the
separate signature check passed. ISO and keyring remain ignored and local.
Actual New-OfflineUbuntuVM.ps1 attempt with requested elevation failed at the
initial Get-VM, before any VM/disk/network mutation. Agent is unelevated; user's
administrator terminal previously passed. Next: run the prepared VM script in
that terminal using powershell.exe -NoProfile -ExecutionPolicy Bypass -File.
No UAC automation, BIOS or network changes; no VM, Ubuntu or Docker startup.
Prepared offline original-image binary probes (including original Manager
1.30.0) with pinned digests, no pulls, network, ports or host mounts. Bash and
PowerShell syntax checks PASS; runtime probes NOT_RUN. Fixed PowerShell 5.1
Bulgarian encoding using UTF-8 BOM. Full service health, OIDC, migrations,
permissions, persistence and backup/restore remain pending. PR #12 updated.
Earlier checkpoints below are historical; ISO is no longer downloading.

### Latest checkpoint — administrator preflight PASS

User-supplied output confirms Elevated=true, HyperVManagementAccess=true,
HypervisorPresent=true, zero VMs, 14.43 GiB free RAM and 112.74 GiB free on C.
Management access works in the user's administrator terminal; the agent remains
unelevated. LinuxStartup=NOT_RUN. Download is active (~35% per curl); no completed ISO. Next: complete Get-UbuntuIso.ps1, require Checksum=PASS, then create
the offline VM. Ubuntu/Docker/original Manager 1.30.0 startup tests and all later
acceptance gates remain pending. Changes continue in PR #12.

### Active execution preparation — 2026-09-14

User selected stepwise Windows / Hyper-V / Ubuntu / Docker Engine / OpenRemote.
This supersedes diagnosis-only scope and Desktop preference. See
 docs/HYPERV_STEP_BY_STEP.md and scripts/staging/*.ps1. Branch:
codex/hyperv-staging-preparation, based on PR #11 (which follows PR #10).
Syntax and ignore checks PASS; 14.43 GiB free RAM, about 114 GiB free on C.
Hyper-V management calls failed for permissions, including requested elevation.
Next: run Test-HyperVHost.ps1 in administrator PowerShell. ISO 24.04.5 download
started locally; completion/checksum pending at this checkpoint. VM creation,
Ubuntu boot, Docker, Java and all service tests NOT_RUN. Network acquisition,
Java rebase, Compose isolation, OIDC, migrations and acceptance remain pending.
No BIOS/device changes. Windows 10 is temporary; Windows 11 planned production.
Earlier sections below are historical snapshots. Open PRs: #11, #10, #9, #7,
#6, #5, #4, #3, #1. No existing PR was merged or changed.

### License/cost evidence

[LICENSE_COST_EVIDENCE.md](docs/LICENSE_COST_EVIDENCE.md) links primary terms.
Hyper-V is included with valid Windows Enterprise; Desktop is conditionally free.
Engine/Ubuntu avoids the Desktop gate, not Windows ESU costs or upstream license
obligations. Local Windows activation was observed without exposing keys.
Purchase/ESU entitlement, Desktop category and full dependency license audit are
unverified. No payment, installation or architecture switch was performed.

### Research: retain Windows host, evaluate Linux VM and Manager 1.30.0 rebase

- [X5660_BACKEND_OPTIONS.md](docs/X5660_BACKEND_OPTIONS.md) separates metadata,
  source evidence, assumptions and mandatory unexecuted startups for all six
  services. [CPU_IMAGE_METADATA.json](docs/CPU_IMAGE_METADATA.json) contains
  public OCI config/manifest identifiers and selected build evidence only.
- User is considering a concept change on this Windows machine. Proposed, not
  adopted: Hyper-V / Ubuntu 24.04 / Docker Engine. Keep Manager 1.30.0; copy its
  immutable app artifacts onto maintained Java 21/glibc, do not downgrade the app.
- Temurin Noble candidate exists; current patch naming/digest must be resolved.
  No image is declared compatible before actual X5660 startup. JNI libraries,
  Keycloak v2 baseline, PostgreSQL extensions and proxy/API native paths remain
  untested. No image build, VM, installation, network or device changes occurred.
- Guest loopback differs from Windows loopback; future management forwarding
  must preserve loopback-only access without exposing applications to the LAN.
- Correction: OpenRemote PostgreSQL candidate contains TimescaleDB per metadata;
  a dedicated GrideX TimescaleDB service is still absent. Activation is untested.
- Next: review concept and finish Java base lock; then separately authorize
  implementation/start tests. Branch codex/manager130-x5660-research follows PR #10.

### Planned: isolated staging of the six main services

- Plan: [STAGING_STARTUP_PLAN.md](docs/STAGING_STARTUP_PLAN.md), baseline main
  279745b. Windows 10 is temporary testing; Windows 11 remains production design.
- Prefer all-users Docker Desktop Hyper-V/Linux containers, conditional on OS
  support/ESU, license and CPU compatibility. No BIOS change or installation.
- New blocker: Manager 1.30.0 uses UBI 10/x86-64-v3; X5660 lacks AVX/AVX2.
  Resolve a reviewed compatible image or suitable host before execution.
- Pending: isolated loopback-only Compose override with no published MQTT,
  physical Agents/rules or device connections; exact API base digest; Keycloak
  bootstrap mapping; internal service-token endpoint preserving external issuer;
  explicit 001/002 SQL execution. Candidate component digests are not runtime proof.
- Acceptance pending: Linux container, merged Compose validation, six healthy
  services, Keycloak/Manager login, API rights/locks, persistence and backup/restore.
- Preserve diagnostics below as dated evidence. The earlier diagnostics commit
  failed on missing identity; its remote branch contains no changes. This plan
  and diagnosis use codex/staging-startup-plan. No runtime or device work occurred.

### Blocked: Windows backend deployment — diagnosis 2026-09-14

- Actual host: HP Z800, Windows 10 Enterprise 22H2 build 19045.4046, two Xeon
  X5660 CPUs (12 cores / 12 visible logical processors), 24 GB RAM. About
  13.7 GiB RAM was free. C: SSD has 114.4/237.9 GiB free/total; D: HDD has
  199.2/465.3 GiB. Windows disk health is Healthy; detailed SMART is untested.
- Hyper-V and its hypervisor are active. CPU virtualization/SLAT flags returned
  false under the hypervisor; this does not prove missing hardware support.
  WSL and VirtualMachinePlatform are disabled; no current-user distribution
  registration was found. Docker was not found in CLI, standard installation
  locations, services or processes. LanmanServer is running / Automatic.
- Missing: local .env and validated container runtime. Compose defines API,
  GrideX PostgreSQL, proxy, OpenRemote PostgreSQL, Keycloak and manager, but no
  separate MQTT ingestion or GrideX TimescaleDB service. The OpenRemote database
  image includes TimescaleDB per subsequent metadata research. No containers started.
- Next: use the Hyper-V-first staging plan before separately authorized installation;
  prepare secrets outside Git and OIDC/OpenRemote integration; pin tested images;
  test services, migrations, backups and telemetry capacity. Keep command writes
  disabled until commissioning. RAM/storage look adequate for an initial test,
  but production capacity is unproven. No installation or network change occurred.
- OS servicing/ESU and updates remain unverified. Windows 10 22H2 standard support
  ended on 2025-10-14. Windows 11 remains planned production, Windows 10 temporary testing.
- Git snapshot: clean main 279745b matched remote main. Open PRs: #9 and drafts
  #7, #6, #5, #4, #3, #1. Refresh this snapshot before dependent work.

### Coordination with the Mac installation

The user reports that their Mac can access ROCK Pi and ESP32 and authorizes
agent coordination and inspection of Git changes. No Mac task/host is visible
in the available task listing; no board state or deployment was independently
verified. Once accessible, exchange repository, branch, commit, PR and sanitized
test evidence. Keep results and next steps in CODEX_STATE.md and HANDOFF.md;
use separate branches and PRs. Never commit or exchange passwords, keys or real
addresses. This permission does not authorize installation or network changes.

### Diagnostic references

- [Docker Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/): WSL backend requires WSL 2.1.5 or later; OS servicing conditions apply.
- [Microsoft Hyper-V requirements](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/host-hardware-requirements): active hypervisors affect requirement reporting.
- [Windows 10 lifecycle](https://learn.microsoft.com/en-ca/lifecycle/announcements/windows-10-22h2-end-of-support-update).

### Planned: local telemetry journal recovery ingestion

The ROCK Pi local NDJSON journal is deployed and bounded, but no journal export,
backend acknowledgement, replay or recovery worker exists yet. The existing
private MQTT ingestion description covers live telemetry only and must not be
treated as journal recovery.

- Dependencies: a versioned Edge-to-backend record and acknowledgement
  contract; private MQTT TLS identities; the dedicated GrideX PostgreSQL/
  Timescale service; and an approved OpenRemote mapping for accepted summaries.
- Required design: the Edge side must export only normalized records outbound
  through the Site Router VPN. The backend must authenticate the source, use a
  stable record identity rather than a process-local sequence alone, persist
  idempotently before acknowledgement, and never expose a ROCK Pi filesystem
  or route OT/BESS to the backend.
- Acceptance evidence: duplicate, reordered, interrupted and restart cases are
  tested; records are retained in PostgreSQL with audit fields; only approved
  live summaries reach OpenRemote; no MQTT command subscription or device
  control path is introduced.
- Contract draft: `docs/TELEMETRY_JOURNAL_RECOVERY_V1.md`.
- Exact next action: agree the versioned export/acknowledgement contract with
  `antouanbg/gridex-edge-gateway`, then implement the PostgreSQL deduplication
  migration and recovery ingestion worker in a separate backend Pull Request.

## Български

### DHCP проверката продължава

VM attach и нормалният рестарт успяха с 22 ACL с уникални приоритети. Няма
наблюдаван DHCP адрес или успешен SSH. Подготвено е изключение само за DHCP
отговори (UDP server 67 към client 68 във вътрешния Default Switch), защото
услугата може да отговаря от различен адрес от host интерфейса. Прилагането
с повишени права още се чака; DHCP/SSH/Docker не са готови. Другите ACL са запазени.


### Поправка в ход: VM работи, DHCP още се чака

Администраторската проверка потвърди работеща gridex-auto с подготвените диск
и seed, но несвързана карта. Поправени са две грешки: очакваният ACL брой беше
23 вместо 22; повтарящите се direction/weight двойки причиниха отказ при
switch attach с 0x800700B7. Уникалните приоритети запазиха ограниченията.
Реалното свързване успя, после новата VM беше нормално изключена и стартирана.
DHCP/SSH/Docker приемането още е pending. Регресионната construction проверка
мина: 22 правила с уникални direction/weight. Не стартирайте отново creation
launcher-а върху съществуващата VM. Без физически устройства; старата VM е запазена.


### Последно: автоматичната VM е подготвена

Потребителят замени ръчната конзолна работа с готова автоматична VM след
съобщен freeze/reboot. Виж docs/AUTOMATED_CLOUD_VM.md. Общият cloud QCOW
checksum/signature, VHD full-data roundtrip и seed ISO/YAML са PASS.
Start-GrideX.cmd е launcher с едно UAC; старата VM се Save-ва, не се изтрива.
Новите VM/DHCP/SSH/ACL/Docker/image runtime са NOT_RUN. Шестте application услуги
още не са разгърнати; OIDC, миграции и приемане остават pending. Branch
codex/automated-cloud-vm следва PR #12. Ключовете и artifacts са само локални.


### Текущ checkpoint — Ubuntu работи; подготовка за offline SSH

Доказателства от потребителя: Ubuntu е инсталиран, рестартиран и има login;
uname показва x86_64. Потребителят настрои internal staging switch и временен
guest IPv4; съобщи за успешен ping до Windows. Без настроени NAT/default route.
SSH услугата липсва; APT отказа по DNS. Провереният ISO архив/package index
съдържа SSH server, SFTP server, libwrap0 и ncurses-term. Следва: връщане на ISO
и APT CD-ROM според docs/OFFLINE_SSH_BOOTSTRAP.md. Dependency resolution и SSH
startup още не са тествани. Docker/Manager 1.30.0 и всички приемателни тестове
остават pending. Адреси, снимки и ключове не се commit-ват. PR #12.

### Последен резултат в отсъствие — ISO проверен; VM creation блокирано

Потребителят разреши изчакване и продължаване в отсъствие. Ubuntu Server 24.04.5
ISO е изтеглен; Get-UbuntuIso.ps1 върна Checksum=PASS и exit 0.
SHA256: 97f3d7ffb032c3eb3b23d2c8be9cc76e60c2c1f2c0146ba5ba9fe01cafae0fd8.
Отделно SHA256SUMS.gpg е проверен с наличния Git GnuPG: VALIDSIG fingerprint
843938DF228D22F7B3742BC0D94AA3F0EFE21092 съвпада с публикувания от Ubuntu.
Signature=NOT_VERIFIED от download скрипта описва само него; отделната проверка
на подписа е успешна. ISO и keyring остават локални и игнорирани.
Реалният опит с New-OfflineUbuntuVM.ps1 при заявено повишаване отказа на началния
Get-VM, преди VM/disk/network промяна. Агентът е без elevated права; терминалът
на потребителя премина проверката. Следва: VM скриптът от този терминал чрез
powershell.exe -NoProfile -ExecutionPolicy Bypass -File.
Без UAC automation, BIOS или мрежови промени; няма VM, Ubuntu или Docker startup.
Подготвени са offline binary probes на оригиналните images (вкл. оригинален
Manager 1.30.0) с фиксирани digests, без pull, мрежа, портове или host mounts.
Bash и PowerShell синтаксис PASS; runtime probes NOT_RUN. Българската кодировка
за PowerShell 5.1 е поправена с UTF-8 BOM. Full service health, OIDC, миграции,
права, persistence и backup/restore остават pending. PR #12 е обновен.
Долните checkpoints са исторически; ISO вече не се изтегля.

### Последен checkpoint — администраторски preflight PASS

Резултатът от потребителя потвърждава Elevated=true, HyperVManagementAccess=true,
HypervisorPresent=true, нула VM, 14,43 GiB свободна RAM и 112,74 GiB на C.
Management достъпът работи в администраторския терминал на потребителя; агентът
остава без повишени права. LinuxStartup=NOT_RUN. Download е активен (~35% според curl); няма завършен ISO. Следва: завършване на Get-UbuntuIso.ps1 с Checksum=PASS, после offline
VM. Ubuntu/Docker/оригинален Manager 1.30.0 startup тестовете и всички следващи
приемателни условия остават pending. Промените продължават в PR #12.

### Активна подготовка за изпълнение — 2026-09-14

Потребителят избра Windows / Hyper-V / Ubuntu / Docker Engine / OpenRemote
стъпка по стъпка. Това заменя обхвата само диагностика и Desktop предпочитанието.
Виж docs/HYPERV_STEP_BY_STEP.md и scripts/staging/*.ps1. Branch:
codex/hyperv-staging-preparation, върху PR #11 (който следва PR #10).
Синтаксисът и ignore проверките са PASS; 14,43 GiB свободна RAM, около 114 GiB на C.
Hyper-V management командите отказаха поради права, включително при заявено
повишаване. Следва: Test-HyperVHost.ps1 в администраторски PowerShell.
ISO 24.04.5 се изтегля локално; завършването/checksum още не са потвърдени.
VM creation, Ubuntu boot, Docker, Java и всички service тестове са NOT_RUN.
Остават network acquisition, Java rebase, Compose изолация, OIDC, миграции и
приемане. Без BIOS/устройства. Windows 10 е временен; Windows 11 планиран production.
Долните секции са исторически снимки. Отворени PR: #11, #10, #9, #7, #6, #5,
#4, #3, #1. Нито един съществуващ PR не е merged или променен.

### Лицензни доказателства

[LICENSE_COST_EVIDENCE.md](docs/LICENSE_COST_EVIDENCE.md) сочи първичните условия.
Hyper-V е включен във валиден Windows Enterprise; Desktop е условно безплатен.
Engine/Ubuntu премахва Desktop gate, не Windows ESU разходите или upstream
лицензните задължения. Наблюдавана е Windows активация без показване на ключове.
Purchase/ESU права, Desktop категория и пълен dependency license audit не са
проверени. Няма плащания, инсталации или смяна на архитектурата.

### Проучване: запазен Windows host, Linux VM и Manager 1.30.0 rebase

- [X5660_BACKEND_OPTIONS.md](docs/X5660_BACKEND_OPTIONS.md) разделя metadata,
  source доказателства, предположения и задължителните неизпълнени startups за
  шестте услуги. [CPU_IMAGE_METADATA.json](docs/CPU_IMAGE_METADATA.json) съдържа
  само публични OCI config/manifest identifiers и избрани build доказателства.
- Потребителят обмисля смяна на концепцията на тази Windows машина. Предложение,
  не прието решение: Hyper-V / Ubuntu 24.04 / Docker Engine. Запазен Manager 1.30.0;
  immutable app artifacts върху поддържана Java 21/glibc, без app downgrade.
- Има Temurin Noble кандидат; current patch име/digest остава за уточняване.
  Без съвместимост преди реален X5660 startup. JNI, Keycloak v2 baseline,
  PostgreSQL extensions и proxy/API native paths не са тествани. Няма build,
  VM, инсталации, мрежови или device промени.
- Guest loopback е различен от Windows loopback; бъдещ management forwarding
  трябва да запази loopback-only достъп без application публикация към LAN.
- Корекция: OpenRemote PostgreSQL кандидатът съдържа TimescaleDB по metadata;
  отделна GrideX TimescaleDB услуга липсва. Активацията не е тествана.
- Следва: преглед на концепцията и Java base lock; после отделно разрешение за
  реализация/start тестове. Branch codex/manager130-x5660-research следва PR #10.

### Планирано: изолиран staging на шестте main услуги

- План: [STAGING_STARTUP_PLAN.md](docs/STAGING_STARTUP_PLAN.md), main 279745b.
  Windows 10 е временен тест; Windows 11 остава production архитектурата.
- Предпочитан all-users Docker Desktop Hyper-V/Linux containers при изпълнени
  OS support/ESU, license и CPU условия. Без BIOS промяна или инсталация.
- Нов блокер: Manager 1.30.0 използва UBI 10/x86-64-v3; X5660 няма AVX/AVX2.
  Нужен е прегледан съвместим image или подходящ host преди изпълнение.
- Предстоят: изолиран loopback-only Compose override без публикуван MQTT,
  physical Agents/rules или device връзки; exact API base digest; Keycloak
  bootstrap mapping; вътрешен service-token endpoint със запазен външен issuer;
  изрични 001/002 SQL миграции. Candidate digests не доказват runtime съвместимост.
- Приемането предстои: Linux container, merged Compose validation, шест healthy
  услуги, Keycloak/Manager login, API права/locks, persistence и backup/restore.
- Диагностиката по-долу се пази като датирани доказателства. Предходният commit
  отказа заради identity; remote branch няма промени. Планът и диагностиката
  са в codex/staging-startup-plan. Не е извършвана runtime или device работа.

### Блокирано: Windows backend deployment — диагностика 2026-09-14

- Реален host: HP Z800, Windows 10 Enterprise 22H2 build 19045.4046, два Xeon
  X5660 (12 ядра / 12 видими логически процесора), 24 GB RAM. Свободни бяха около
  13.7 GiB RAM. C: SSD има 114.4/237.9 GiB свободни/общо; D: HDD има
  199.2/465.3 GiB. Windows отчита Healthy; подробен SMART тест не е правен.
- Hyper-V и хипервайзорът му са активни. CPU флаговете за виртуализация/SLAT
  върнаха false при активния хипервайзор; това не доказва липса на поддръжка.
  WSL и VirtualMachinePlatform са изключени; не е намерена дистрибуция за текущия
  потребител. Docker не е намерен в CLI, стандартните места за инсталация, услуги
  или процеси. LanmanServer е Running / Automatic.
- Липсват локален .env и проверен container runtime. Compose определя API,
  GrideX PostgreSQL, proxy, OpenRemote PostgreSQL, Keycloak и manager, но няма
  отделна MQTT ingestion или GrideX TimescaleDB услуга. OpenRemote DB image включва
  TimescaleDB според последващото metadata проучване. Няма стартирани контейнери.
- Следва: Hyper-V staging планът преди отделно разрешена инсталация;
  подготовка на тайни извън Git и OIDC/OpenRemote интеграция; фиксиране на тествани
  images; тест на услуги, миграции, архиви и капацитет за телеметрия. Командните
  записи остават изключени до commissioning. RAM/дисковете изглеждат достатъчни
  за начален тест, но production капацитетът не е доказан. Няма инсталации или
  мрежови промени.
- OS поддръжката/ESU и актуализациите не са проверени. Стандартната поддръжка на
  Windows 10 22H2 приключи на 2025-10-14. Windows 11 остава планиран production,
  а Windows 10 е временен тест.
- Git снимка: чист main 279745b съвпадаше с remote main. Отворени PR-и: #9 и
  чернови #7, #6, #5, #4, #3, #1. Обнови снимката преди зависима работа.

### Координация с Mac инсталацията

По данни на потребителя Mac машината му има достъп до ROCK Pi и ESP32 и той
разрешава комуникация между агенти и проверка на Git промените. В наличния списък
със задачи няма видим Mac task/host; състоянието и deployment-ите на платките
не са независимо проверени. При достъп да се обменят repository, branch, commit,
PR и тестови доказателства без чувствителни данни. Резултатите и следващите стъпки
се пазят в CODEX_STATE.md и HANDOFF.md; използват се отделни branches и PR-и.
Никога не се записват в Git или обменят пароли, ключове или реални адреси.
Това разрешение не включва инсталации или мрежови промени.

### Източници за диагностиката

- [Docker Windows изисквания](https://docs.docker.com/desktop/setup/install/windows-install/): WSL backend изисква WSL 2.1.5 или по-нов; важат условията за OS поддръжка.
- [Microsoft Hyper-V изисквания](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/host-hardware-requirements): активните хипервайзори влияят на отчитането на изискванията.
- [Windows 10 жизнен цикъл](https://learn.microsoft.com/en-ca/lifecycle/announcements/windows-10-22h2-end-of-support-update).

### Планирано: recovery ingestion на local telemetry journal

Local NDJSON журналът на ROCK Pi е внедрен и ограничен по размер, но все още
няма export на журнала, backend acknowledgement, replay или recovery worker.
Съществуващото описание за private MQTT ingestion важи само за live telemetry
и не трябва да се приема за journal recovery.

- Зависимости: versioned Edge-to-backend record и acknowledgement договор;
  private MQTT TLS идентичности; отделната GrideX PostgreSQL/Timescale услуга;
  и одобрена OpenRemote mapping схема за приетите обобщени данни.
- Задължителен дизайн: Edge страната изнася само нормализирани записи outbound
  през Site Router VPN. Backend-ът удостоверява източника, използва устойчив
  record identity вместо само process-local sequence, записва idempotent преди
  acknowledgement и никога не излага ROCK Pi файлова система или не route-ва
  OT/BESS към backend.
- Приемателни доказателства: тествани са duplicate, reordered, interrupted и
  restart случаи; записите се пазят в PostgreSQL с audit полета; само одобрени
  live summaries достигат OpenRemote; не се добавя MQTT command subscription
  или device control path.
- Чернова на договора: `docs/TELEMETRY_JOURNAL_RECOVERY_V1.md`.
- Точно следващо действие: договори versioned export/acknowledgement договора
  с `antouanbg/gridex-edge-gateway`, после имплементирай PostgreSQL
  deduplication migration и recovery ingestion worker в отделен backend Pull
  Request.
