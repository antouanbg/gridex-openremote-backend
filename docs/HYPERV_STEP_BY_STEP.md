# Hyper-V staging steps / Стъпки за Hyper-V staging

## English

Final download checkpoint: ISO SHA256 PASS; separate SHA256SUMS signature PASS.
Actual VM creation attempt failed at initial Get-VM for agent permissions,
before mutations. Run the following in the user's administrator PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\GrideX\gridex-openremote-backend\scripts\staging\New-OfflineUbuntuVM.ps1"
```

Then use Hyper-V Manager → Connect for the offline installer as described below.
VM/Ubuntu/Docker/OpenRemote startup remain NOT_RUN.

Latest update: user administrator preflight passed (Elevated and management
access true; zero VMs). The agent process still fails the same access check,
including requested elevation. User authorized continuation while away.
Ubuntu SHA256SUMS detached signature verified with Git's existing GnuPG and
fingerprint `843938DF228D22F7B3742BC0D94AA3F0EFE21092`, matching the
[Ubuntu verification guide](https://ubuntu.com/tutorials/how-to-verify-ubuntu).
The ISO content check remains separate. The earlier observations below are
dated preparation context. No global execution-policy change is needed: use
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File <script>` for one process.
Scripts now contain a UTF-8 BOM for Windows PowerShell 5.1 Bulgarian messages.

Prepared `scripts/staging/probe-original-images.sh` for the Ubuntu guest after
Docker installation and reviewed image acquisition. Run with Bash from a copy
of this repository, without secrets. It uses the six original recorded image
digests (Node is the API base, not a built API image); no automatic pulls, ports,
host mounts or container network. Local results go under `.local-staging/`.
Only binary-version probes are performed: they bypass service entrypoints,
authentication, databases, extensions and healthchecks. A nonzero exit needs
stderr analysis; it does not by itself prove a CPU instruction failure.
All service startup and native integration acceptance tests remain NOT_RUN.

2026-09-14: user selected stepwise testing of Windows → Hyper-V → Ubuntu →
Docker Engine → OpenRemote. This supersedes the earlier diagnosis-only scope
and Desktop preference. Windows 10 remains temporary; Windows 11 remains the
planned production architecture. No BIOS changes or physical device access.

### Step 1 — prepare and boot offline Ubuntu

Host preflight: Hyper-V is active, about 114 GiB free on C. The current process
is not elevated; both ordinary and requested elevated Get-VM/Get-VMSwitch calls
failed with Hyper-V authorization errors. No VM inventory was obtained. This is
an access blocker, not evidence that Linux or the CPU is incompatible.

Prepared scripts (run from the repository in PowerShell):

```powershell
.\scripts\staging\Test-HyperVHost.ps1
.\scripts\staging\Get-UbuntuIso.ps1
.\scripts\staging\New-OfflineUbuntuVM.ps1 -WhatIf
.\scripts\staging\New-OfflineUbuntuVM.ps1
```

The first and last two commands require Hyper-V management rights. Open
PowerShell with **Run as administrator**, change to this repository, and run
the preflight first. Do not run the download twice concurrently. The download
script supports resuming a partial download. It checks this official release:

- [Ubuntu Server 24.04.5 amd64 ISO](https://releases.ubuntu.com/24.04/ubuntu-24.04.5-live-server-amd64.iso)
- [Published SHA256SUMS](https://releases.ubuntu.com/24.04/SHA256SUMS)
- SHA256: `97f3d7ffb032c3eb3b23d2c8be9cc76e60c2c1f2c0146ba5ba9fe01cafae0fd8`

The checksum is pinned from Canonical HTTPS; detached-signature verification
has not been performed. ISO, partial downloads, VM and local evidence belong
under ignored `.local-staging/`. No secret belongs in Git or console transcripts.

The VM script refuses existing VM/directory, insufficient free RAM (<10 GiB)
or disk (<100 GiB). It creates a new Generation 2 VM, 4 virtual CPUs, fixed
8 GiB RAM, an 80 GiB dynamically allocated disk, Ubuntu Secure Boot template,
and **no network adapter**. It starts the ISO; it does not install Ubuntu or
configure a switch, NAT, firewall or BIOS. No automatic destructive rollback.
If interrupted during creation, inspect the partial VM before continuing.

Open Hyper-V Manager → `gridex-cpu-staging` → Connect. Boot the installer and
open its shell (Help → Enter shell). Run:

```sh
uname -m
systemd-detect-virt
grep -m1 '^flags' /proc/cpuinfo
```

Acceptance: the actual Linux shell runs; architecture is x86_64 and virtualization
is reported as microsoft. Record CPU flags without hostnames or addresses.
Do not claim application compatibility. Ubuntu installation is the next
interactive step: use only the new 80 GiB VM disk, no network, no Ubuntu Pro,
no optional software, and keep the local account password outside Git.

### Later steps — execute only in order

2. Finish and reboot Ubuntu; repeat CPU evidence from the installed guest.
3. Prepare restricted package/image acquisition and install Docker Engine from
   its official Ubuntu repository, recording exact package versions. Do not
   attach the VM to an external/LAN switch or bridge. A controlled egress and
   management design is still pending; no network script is supplied yet.
4. Run a Linux container with no network; test the original Manager 1.30.0 JVM
   by immutable digest. Record exit code/stderr. A Java version probe is only
   a JVM test, not a healthy Manager startup. Hyper-V cannot add missing AVX.
5. If the original JVM fails, build Manager 1.30.0 on the reviewed Java 21 base
   as described in X5660_BACKEND_OPTIONS.md; preserve application hashes and
   test native libraries, entrypoint, healthcheck and complete service startup.
6. Validate the separate staging Compose override, then start all six services
   on an internal Docker network. Publish HTTP/HTTPS/API only on guest loopback;
   Windows access needs explicit loopback-only management forwarding. No MQTT
   publication, physical Agents/rules or device access. Resolve OIDC bootstrap,
   internal token endpoint, migrations and local secrets first.
7. Test health, Keycloak/OpenRemote login, API permissions, persistence after
   restart, then backup and restore to separate empty volumes. No production
   commissioning until all gates pass.

Status: scripts prepared; their PowerShell syntax can be checked without VM
access. VM creation, Ubuntu boot, Docker, JVM probes and all service tests are
NOT_RUN. ISO download completion/checksum is a separate gate. Licensing evidence
is in LICENSE_COST_EVIDENCE.md; no paid Desktop is needed for this Engine route.

## Български

Краен download checkpoint: ISO SHA256 PASS; отделен SHA256SUMS signature PASS.
Реалният VM creation опит отказа на началния Get-VM поради правата на агента,
преди промени. Изпълнява се от администраторския PowerShell на потребителя:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\GrideX\gridex-openremote-backend\scripts\staging\New-OfflineUbuntuVM.ps1"
```

После Hyper-V Manager → Connect за offline installer, както е описано по-долу.
VM/Ubuntu/Docker/OpenRemote startup остават NOT_RUN.

Последно: администраторският preflight на потребителя е успешен (Elevated и
management access true; нула VM). Процесът на агента още няма този достъп,
включително при заявено повишаване. Потребителят разреши продължаване в отсъствие.
Detached signature на Ubuntu SHA256SUMS е проверен с наличния GnuPG от Git и
fingerprint `843938DF228D22F7B3742BC0D94AA3F0EFE21092`, съвпадащ с
[Ubuntu verification guide](https://ubuntu.com/tutorials/how-to-verify-ubuntu).
Проверката на съдържанието на ISO е отделна. Долните ранни наблюдения са контекст
от подготовката. Не е нужна глобална промяна на execution policy: използва се
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File <script>` за един процес.
Скриптовете вече имат UTF-8 BOM за българските съобщения в Windows PowerShell 5.1.

Подготвен е `scripts/staging/probe-original-images.sh` за Ubuntu guest след
Docker инсталация и прегледано image acquisition. Изпълнява се с Bash от копие
на repository без secrets. Използва шестте оригинални записани image digests
(Node е API базата, не built API image); без автоматичен pull, портове,
host mounts или container мрежа. Резултатите остават в `.local-staging/`.
Прави само binary-version probes: пропуска service entrypoints, authentication,
бази данни, extensions и healthchecks. Ненулев exit изисква анализ на stderr;
сам по себе си не доказва отказ поради CPU инструкции. Всички service startup
и native integration приемателни тестове остават NOT_RUN.

2026-09-14: потребителят избра последователно тестване на Windows → Hyper-V →
Ubuntu → Docker Engine → OpenRemote. Това заменя предишния обхват само за
диагностика и предпочитанието за Desktop. Windows 10 остава временен;
Windows 11 остава планираната production архитектура. Без BIOS промени и
без достъп до физически устройства.

### Стъпка 1 — подготовка и зареждане на Ubuntu без мрежа

Host проверка: Hyper-V работи, на C има около 114 GiB свободни. Текущият процес
не е elevated; обикновените и заявените elevated Get-VM/Get-VMSwitch завършиха
с отказ за права от Hyper-V. Списък на VM не е получен. Това е пречка за достъп,
а не доказателство за несъвместимост на Linux или CPU.

Подготвени скриптове (изпълняват се от repository в PowerShell):

```powershell
.\scripts\staging\Test-HyperVHost.ps1
.\scripts\staging\Get-UbuntuIso.ps1
.\scripts\staging\New-OfflineUbuntuVM.ps1 -WhatIf
.\scripts\staging\New-OfflineUbuntuVM.ps1
```

Първата и последните две команди изискват права за управление на Hyper-V.
Отворете PowerShell с **Run as administrator**, преминете в repository и първо
изпълнете preflight. Не стартирайте изтеглянето едновременно два пъти. Скриптът
за изтегляне поддържа продължаване на частичен download и проверява този release:

- [Ubuntu Server 24.04.5 amd64 ISO](https://releases.ubuntu.com/24.04/ubuntu-24.04.5-live-server-amd64.iso)
- [Публикуван SHA256SUMS](https://releases.ubuntu.com/24.04/SHA256SUMS)
- SHA256: `97f3d7ffb032c3eb3b23d2c8be9cc76e60c2c1f2c0146ba5ba9fe01cafae0fd8`

Checksum е фиксиран от Canonical HTTPS; detached signature не е проверен.
ISO, частичните downloads, VM и локалните резултати са в игнорираната
`.local-staging/`. Secrets не се записват в Git или console transcripts.

VM скриптът отказва при съществуваща VM/папка, недостатъчна свободна RAM
(<10 GiB) или диск (<100 GiB). Създава нова Generation 2 VM, 4 виртуални CPU,
фиксирани 8 GiB RAM, динамичен диск 80 GiB, Ubuntu Secure Boot template и
**без мрежова карта**. Стартира ISO; не инсталира Ubuntu и не конфигурира switch,
NAT, firewall или BIOS. Няма автоматичен разрушителен rollback. При прекъсване
по време на създаване проверете частичната VM, преди да продължите.

Отворете Hyper-V Manager → `gridex-cpu-staging` → Connect. Заредете installer
и отворете shell (Help → Enter shell). Изпълнете:

```sh
uname -m
systemd-detect-virt
grep -m1 '^flags' /proc/cpuinfo
```

Приемане: реалният Linux shell работи; архитектурата е x86_64 и виртуализацията
е microsoft. Запишете CPU flags без hostnames и адреси. Това не доказва
съвместимост на приложението. Инсталацията на Ubuntu е следващата интерактивна
стъпка: само новият 80 GiB VM диск, без мрежа, без Ubuntu Pro и допълнителен
софтуер; паролата за локалния акаунт остава извън Git.

### Следващи стъпки — изпълняват се последователно

2. Завършване и рестарт на Ubuntu; повторна CPU проверка от инсталирания guest.
3. Подготовка на ограничен достъп за packages/images и инсталация на Docker
   Engine от официалното Ubuntu repository с точни package версии. Без external/
   LAN switch или bridge за VM. Контролираният egress и management достъп още
   трябва да се разработят; засега няма мрежов скрипт.
4. Linux container без мрежа; тест на оригиналната Manager 1.30.0 JVM по
   immutable digest. Запис на exit code/stderr. Java version probe е само JVM
   тест, не здрав Manager startup. Hyper-V не добавя липсващ AVX.
5. При отказ на оригиналната JVM — build на Manager 1.30.0 върху прегледаната
   Java 21 база от X5660_BACKEND_OPTIONS.md; запазване на application hashes и
   тестове на native libraries, entrypoint, healthcheck и пълен service startup.
6. Валидация на отделния staging Compose override и старт на шестте услуги
   във вътрешна Docker мрежа. HTTP/HTTPS/API само на guest loopback; достъпът от
   Windows изисква изрично loopback-only management forwarding. Без публикуван
   MQTT, физически Agents/rules и достъп до устройства. Първо се решават OIDC
   bootstrap, вътрешният token endpoint, миграциите и локалните secrets.
7. Health, Keycloak/OpenRemote login, API права, запазване след рестарт, после
   backup/restore в отделни празни volumes. Без production commissioning,
   докато всички условия не бъдат изпълнени.

Статус: скриптовете са подготвени; PowerShell синтаксисът може да се провери
без VM достъп. VM creation, Ubuntu boot, Docker, JVM probes и всички service
тестове са NOT_RUN. Завършен ISO download/checksum е отделно условие.
Лицензните доказателства са в LICENSE_COST_EVIDENCE.md; този Engine вариант
не изисква платен Desktop.
