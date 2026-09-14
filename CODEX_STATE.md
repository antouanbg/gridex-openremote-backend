# CODEX_STATE.md

## English

### Latest checkpoint — administrator preflight PASS

User-supplied output confirms Elevated=true, HyperVManagementAccess=true,
HypervisorPresent=true, no existing VMs, 14.43 GiB free RAM and 112.74 GiB
free on C. The earlier management-permission blocker is resolved in the user's
administrator terminal, not in the agent process. LinuxStartup remains NOT_RUN.
Local inspection found only a 16 KiB partial ISO, no completed ISO. Next: finish
Get-UbuntuIso.ps1 and require Checksum=PASS before creating the offline VM.
Continue in PR #12; no Ubuntu, Docker or OpenRemote compatibility claim yet.

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

### Current task — 2026-09-14

License/cost evidence added in docs/LICENSE_COST_EVIDENCE.md: included Hyper-V,
conditional free Desktop, Engine alternative, Windows ESU and upstream licenses.
Windows reports activated; purchase/ESU rights and Desktop eligibility unverified.
No blanket zero-cost guarantee or runtime compatibility claim. No purchases.

Research the existing Windows HP Z800 concept and Manager 1.30.0 CPU-compatible
runtime candidates: docs/X5660_BACKEND_OPTIONS.md and CPU_IMAGE_METADATA.json.
Preferred option to evaluate is Hyper-V / Ubuntu 24.04 VM / Docker Engine,
preserving Manager 1.30.0. No architecture switch or installation was executed.
Temurin 21/Noble is a candidate, not startup-proven. All five other service image
paths were inspected through source/registry metadata; native-code tests remain.
Resolve the latest Java patch tag/digest, build an artifact-identical repackage,
audit JNI and perform real X5660 guest startups before claiming compatibility.
Branch: codex/manager130-x5660-research; follows planning PR #10.

### Previous staging plan — retained context

Prepare the isolated six-service staging plan against main 279745b and retain
the read-only Windows backend diagnosis. Plan: docs/STAGING_STARTUP_PLAN.md.
Windows 10 is temporary testing; Windows 11 remains planned production.
Current blockers: Manager 1.30.0 UBI 10 requires CPU instructions absent on
X5660 (AVX/AVX2 runtime checks false); Docker OS support/ESU and license category
unverified; API token endpoint uses external localhost issuer; migrations run
only 001 automatically. Candidate image digests are recorded, not runtime-proven.
The staging override, token endpoint fix and all acceptance tests are pending.
Keep this file
and HANDOFF.md current; use a separate branch and PR for changes. No installations
or network changes are authorized. Never commit passwords, keys or real addresses.

### Completed

- Read the recovery documents and inspected Git and Compose.
- Clean main at 279745b matched GitHub main at diagnosis time.
- Seven open PRs: #9, and drafts #7, #6, #5, #4, #3, #1.
- Confirmed HP Z800 / Windows 10 Enterprise 22H2 build 19045.4046.
- Two Xeon X5660 CPUs: 12 total cores and 12 visible logical processors.
- 24 GB RAM; 23.98 GiB usable and approximately 13.7 GiB free.
- C: SSD, 237.9 GiB total / 114.4 GiB free; D: HDD, 465.3 GiB total /
  199.2 GiB free. Windows reports Healthy; detailed SMART testing was not done.
- Hyper-V enabled and hypervisor active; vmcompute and hns running.
- WSL and VirtualMachinePlatform disabled; no current-user WSL distribution
  registration found. Docker CLI, standard Desktop installations, services and
  processes not found. LanmanServer running with Automatic startup.
- Local .env absent. No containers started or runtime validation performed.

### Remaining / next steps

1. Prefer Docker Desktop all-users / Hyper-V / Linux containers after CPU image,
   OS support/ESU and license gates. Containers feature is disabled. Installation
   and any network changes need separate authorization; no BIOS changes.
2. Prepare secrets outside Git, OIDC and OpenRemote configuration; pin tested
   images; validate the six Compose services, migrations, backups and capacity.
3. Complete private MQTT ingestion and commissioning; keep writes disabled.
   Compose has no separate MQTT ingestion or GrideX TimescaleDB service; the
   selected OpenRemote PostgreSQL image includes TimescaleDB per metadata.
4. Preserve the earlier recovery task: agree the versioned Edge export/ack
   contract, then implement and test idempotent PostgreSQL ingestion in a
   separate PR. No journal export, acknowledgement, replay or recovery worker
   exists yet according to the previous handoff.
5. The user reports that their Mac installation can access ROCK Pi and ESP32
   and permits agent coordination and Git progress inspection. No Mac task/host
   is visible in the available task listing; board state is not independently
   verified. Once a task is accessible, exchange repository, branch, commit,
   PR and sanitized test evidence, never passwords or keys.

### Validation

Documentation only; EN/BG compared and git diff --check passed before commit.
No Compose/runtime acceptance is claimed. The earlier commit attempt failed
because Git identity was unset; its remote diagnostics branch has no changes.
The combined diagnosis and plan are on codex/staging-startup-plan.
No installation, network change, device command or deployment was performed.
Detailed blockers and source links are retained in HANDOFF.md.

## Български

### Последен checkpoint — администраторски preflight PASS

Резултатът от потребителя потвърждава Elevated=true, HyperVManagementAccess=true,
HypervisorPresent=true, без съществуващи VM, 14,43 GiB свободна RAM и 112,74 GiB
свободни на C. Пречката с правата е отстранена в администраторския терминал на
потребителя, не в процеса на агента. LinuxStartup остава NOT_RUN.
Локалната проверка намери само частичен ISO от 16 KiB, без завършен ISO. Следва:
завършване на Get-UbuntuIso.ps1 с Checksum=PASS преди създаване на offline VM.
Продължаваме в PR #12; още няма доказана Ubuntu, Docker или OpenRemote съвместимост.

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

### Текуща задача — 2026-09-14

Добавени лицензни доказателства в docs/LICENSE_COST_EVIDENCE.md: включен Hyper-V,
условно безплатен Desktop, Engine алтернатива, Windows ESU и upstream лицензи.
Windows отчита активиран; purchase/ESU rights и Desktop категорията не са проверени.
Без обща zero-cost гаранция или runtime съвместимост. Няма покупки.

Проучване на концепцията за наличния Windows HP Z800 и CPU runtime кандидати за
Manager 1.30.0: docs/X5660_BACKEND_OPTIONS.md и CPU_IMAGE_METADATA.json.
Предпочитан вариант за оценка: Hyper-V / Ubuntu 24.04 VM / Docker Engine със
запазен Manager 1.30.0. Не е извършена смяна на архитектура или инсталация.
Temurin 21/Noble е кандидат, без startup доказателство. Проверени са source/registry
metadata за останалите пет service image пътя; native-code тестовете предстоят.
Следва: latest Java patch tag/digest, repackage със същите app artifacts, JNI audit
и реални X5660 guest startups преди заключение за съвместимост.
Branch: codex/manager130-x5660-research; следва planning PR #10.

### Предходен staging план — запазен контекст

Подготовка на изолиран план за шестте услуги от main 279745b със запазена
диагностика чрез четене. План: docs/STAGING_STARTUP_PLAN.md.
Windows 10 е временна тестова среда; Windows 11 остава планиран production.
Блокери: Manager 1.30.0 UBI 10 изисква липсващи X5660 CPU инструкции
(AVX/AVX2 runtime проверки false); Docker OS support/ESU и license категорията
не са проверени; API token endpoint използва външния localhost issuer;
автоматично се изпълнява само миграция 001. Записаните image digests са кандидати,
не runtime-доказан комплект. Staging override, token endpoint fix и всички
приемателни тестове предстоят.
Този файл и HANDOFF.md се поддържат актуални; промените са в отделен branch и PR.
Не са разрешени инсталации или мрежови промени. Пароли, ключове и реални адреси
никога не се записват в Git.

### Завършено

- Прочетени са recovery документите и са проверени Git и Compose.
- Чист main на 279745b съвпадаше с GitHub main при диагностиката.
- Седем отворени PR-а: #9 и чернови #7, #6, #5, #4, #3, #1.
- Потвърден HP Z800 / Windows 10 Enterprise 22H2 build 19045.4046.
- Два Xeon X5660: общо 12 ядра и 12 видими логически процесора.
- 24 GB RAM; 23.98 GiB използваеми и около 13.7 GiB свободни.
- C: SSD, 237.9 GiB общо / 114.4 GiB свободни; D: HDD, 465.3 GiB общо /
  199.2 GiB свободни. Windows отчита Healthy; подробен SMART тест не е правен.
- Hyper-V е включен, хипервайзорът е активен; vmcompute и hns работят.
- WSL и VirtualMachinePlatform са изключени; не е намерена WSL дистрибуция за
  текущия потребител. Не са намерени Docker CLI, стандартни Desktop инсталации,
  услуги или процеси. LanmanServer работи със старт Automatic.
- Локален .env липсва. Не са стартирани контейнери или правени runtime проверки.

### Оставащо / следващи стъпки

1. Предпочитан Docker Desktop all-users / Hyper-V / Linux containers след CPU
   image, OS support/ESU и license условията. Containers feature е изключен.
   Инсталации и мрежови промени изискват отделно разрешение; без BIOS промени.
2. Подготовка на тайни извън Git, OIDC и OpenRemote конфигурация; фиксиране на
   тествани images; проверка на шестте Compose услуги, миграции, архиви и капацитет.
3. Завършване на private MQTT ingestion и commissioning; записите остават
   изключени. Compose няма отделна MQTT ingestion или GrideX TimescaleDB услуга;
   избраният OpenRemote PostgreSQL image включва TimescaleDB според metadata.
4. Запазва се предходната recovery задача: договаряне на versioned Edge export/ack
   договор, после имплементиране и тест на idempotent PostgreSQL ingestion в
   отделен PR. Според предходния handoff още няма journal export,
   acknowledgement, replay или recovery worker.
5. По данни на потребителя Mac инсталацията му има достъп до ROCK Pi и ESP32;
   разрешени са комуникация между агенти и проверка на напредъка в Git. В наличния
   списък със задачи няма видим Mac task/host; платките не са независимо проверени.
   При достъпна задача да се обменят repository, branch, commit, PR и тестови
   доказателства без чувствителни данни, никога пароли или ключове.

### Проверки

Само документация; EN/BG са сравнени и git diff --check мина преди commit.
Не се заявява Compose/runtime приемане. Предходният commit опит отказа заради
липсваща Git identity; remote diagnostics branch няма промени.
Обединените диагностика и план са в codex/staging-startup-plan.
Не са правени инсталации, мрежови промени, команди към устройства или deployment.
Подробните блокиращи условия и източници са запазени в HANDOFF.md.
