# CODEX_STATE.md

## English

### Current task — 2026-09-14

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
   Compose has no separate MQTT ingestion service or TimescaleDB.
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

### Текуща задача — 2026-09-14

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
   изключени. Compose няма отделна MQTT ingestion услуга или TimescaleDB.
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
