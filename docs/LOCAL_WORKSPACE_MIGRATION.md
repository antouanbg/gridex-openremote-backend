# Local workspace migration out of Google Drive / Преместване на локалния проект извън Google Drive

**Status (2026-10-01): documented plan, not executed.** The target directory is not approved. This moves development source on the current Mac; it is **not** a cloud/host migration or a restoration of production data. For that separate task, see [DEPLOYMENT.md](../DEPLOYMENT.md).

## English

### What exists and what moves

The current development root (`OLD_ROOT`) is inside Google Drive's `My Drive`. An inventory found about 12 GB there, 72 Git worktrees across four repositories and seven worktrees with local changes. These figures are a dated snapshot, not a deletion list. The desired `NEW_ROOT` must be a normal local folder outside `CloudStorage`; choose and approve its exact path before acting.

| Component | New local source | Keep separate / do not copy into Git |
| --- | --- | --- |
| [Portal](https://github.com/antouanbg/gridex-energy-os) | One fresh, reviewed `main` checkout | Generated `node_modules`, build output and old worktrees |
| [OpenRemote backend](https://github.com/antouanbg/gridex-openremote-backend) | One fresh, reviewed `main` checkout | Private backend `.env`, database volumes and certificates |
| [Docusaurus documentation](https://github.com/antouanbg/gridex-docs) | One fresh, reviewed `main` checkout | Generated `node_modules` and `build` |
| [ROCK Pi / ESP32 Edge](https://github.com/antouanbg/gridex-edge-gateway) | One fresh, reviewed `main` checkout | Generated firmware/build directories and physical-device state |

The 25 `node_modules` directories accounted for about 10.8 GiB (19 portal, six docs). None needs copying: restore dependencies from each checkout's tracked lockfile only when building it. Build/test output and Edge `.pio` are also regenerated. Do **not** infer that all 72 worktrees are disposable: review the seven dirty worktrees and any untracked files before retiring any old checkout. Preserve Git history and changes by publishing/reconciling them, not by copying every worktree.

### Live runtime boundary

`RUNTIME_ROOT` is already outside Google Drive and contains private backend settings, MQTT certificates/configuration, proxy state and backups. Do not commit, display, or relocate its values as part of this source migration. The active Docker/Colima data and named volumes are also outside Google Drive. In particular, OpenRemote, GrideX and market databases, Grafana state and MQTT state must **not** be reset, pruned, recreated empty or copied as raw VM disks. This work does not change Edge Ethernet, enrolment or commissioning.

Two running services currently depend on paths under `OLD_ROOT`: the documentation container bind-mounts its built site and Nginx configuration, while Grafana bind-mounts backend dashboard/provisioning files. The backend Compose project's working directory also points there. Other runtime mounts (for example MQTT and public proxy) refer to `RUNTIME_ROOT`. Therefore making `OLD_ROOT` online-only, disconnecting Drive, or deleting it **before** changing and validating those mounts can break the running site even if Git clones exist elsewhere.

### Controlled sequence

1. **Approve target and capture baseline.** Choose `NEW_ROOT` outside Google Drive and ensure free disk space. Record the exact active checkout branch/SHA/dirty status for all four repositories; review the seven dirty worktrees separately. Record selected Compose overlays, effective bind mounts, volume names and health checks. Confirm private backups/restoration are usable without exposing contents. This is read-only preparation.
2. **Create clean source copies.** Fresh-clone the reviewed `main` of each repository into separate directories under `NEW_ROOT`. Compare expected commit SHAs and check each checkout is clean. Do not copy `node_modules`, build output, Docker volumes, `RUNTIME_ROOT`, or all historical worktrees. Install dependencies from lockfiles (`npm ci`) only for the portal/docs checkout that will actually be built. Keep the old copies and live containers intact.
3. **Repin development tools.** Change the saved Codex project folder(s) to the new checkout(s), set the intended primary folder and confirm repository instructions/working directory resolve there. Existing tasks may retain the old directory; open a new task in the new project for a real path check. Git remote stays the durable source; Google Drive is not the source of truth for code.
4. **Plan a separately approved runtime cutover.** Rebuild docs at the new path and update its two bind mounts. Update Grafana dashboard/provisioning bind mounts and the backend Compose working directory/invocation to the new path. Render/validate the selected Compose files before touching containers. Recreate only affected containers in a maintenance window; never use volume-removal or `down -v`. Leave the single private backend `.env` and external MQTT/proxy mounts in place. Run the same checks after every change.
5. **Accept or roll back.** Verify docs BG/EN and assets, Grafana dashboards, portal/API/auth routes, MQTT/heartbeat, and database persistence. Check the mounts now point to `NEW_ROOT` and no running service depends on `OLD_ROOT`. If a check fails, restore the old bind paths/Compose invocation and recreate only affected containers; preserve volumes and the old working tree. Record evidence in [HANDOFF.md](../HANDOFF.md). Only after acceptance and separate approval may old redundant copies be archived or removed. Never remove the seven dirty worktrees, untracked assets or private runtime as a bulk cleanup.

### Google Drive after cutover

Keep an archival copy in Drive if desired, but do not use it as the active source/build directory. Google Drive for desktop's **Stream files** keeps files primarily in the cloud and downloads/caches them on access; it is not a guarantee of zero local copies or zero sync activity. **Mirror files** keeps a full local copy. Verify upload completion before changing modes, and do not delete the old folder merely because it appears in Finder. After the runtime has no `OLD_ROOT` mounts and Codex points to `NEW_ROOT`, choose an online-only/archive policy for the Drive copy. [Google's Stream/Mirror guide](https://support.google.com/drive/answer/13401938) explains the current product settings.

### Acceptance gate

- Four clean, reproducible Git checkouts at the approved local path; required uncommitted/untracked work accounted for.
- No active service or Codex project uses the Drive source path; the old source remains recoverable during the transition.
- No secret, client data, runtime certificate, database volume or Edge setting moved into Git or deleted.
- Docs, Grafana, portal, authentication, API, MQTT and persistent data pass the recorded checks after cutover; rollback has been rehearsed.
- Only then consider disabling Drive sync for the archive. **None of these gates is claimed complete by this document.**

## Български

### Кое съществува и кое се мести

Сегашният работен корен (`OLD_ROOT`) е в `My Drive` на Google Drive. Описът към 01.10.2026 г. показва около 12 GB, 72 Git работни копия от четири хранилища и седем копия с локални промени. Това е моментна снимка, **не** списък за триене. Новият `NEW_ROOT` трябва да е обикновена локална папка извън `CloudStorage`; точният път се избира и одобрява преди действие.

| Компонент | Ново локално работно копие | Остава отделно / не влиза в Git |
| --- | --- | --- |
| [Портал](https://github.com/antouanbg/gridex-energy-os) | Едно ново копие от прегледан `main` | Генерираните `node_modules`, build и старите работни копия |
| [OpenRemote backend](https://github.com/antouanbg/gridex-openremote-backend) | Едно ново копие от прегледан `main` | Частният `.env`, базите и сертификатите |
| [Docusaurus документация](https://github.com/antouanbg/gridex-docs) | Едно ново копие от прегледан `main` | Генерираните `node_modules` и `build` |
| [ROCK Pi / ESP32 Edge](https://github.com/antouanbg/gridex-edge-gateway) | Едно ново копие от прегледан `main` | Генерираните firmware/build файлове и състоянието на устройствата |

25 папки `node_modules` заемат около 10,8 GiB (19 за портала и шест за документацията). Нито една не се копира: зависимостите се възстановяват от версионирания lockfile само ако съответното копие ще се билдва. Build/test резултатите и Edge `.pio` също се генерират наново. Не приемай всичките 72 копия за ненужни: седемте с промени и всички непубликувани файлове се преглеждат преди архивиране. Запази промените чрез Git и преглед, не чрез пренасяне на всички работни папки.

### Граница с работещата система

`RUNTIME_ROOT` вече е извън Google Drive. Там са частните backend настройки, MQTT сертификати/конфигурация, proxy състоянието и архивите. Не ги публикувай, показвай или премествай като част от тази миграция на кода. Docker/Colima и постоянните volumes също са извън Drive. Базите на OpenRemote, GrideX и пазара, състоянието на Grafana и MQTT **не** се нулират, изтриват или пренасят като суров VM диск. Не се променят Ethernet, enrolment и commissioning на Edge.

Две работещи услуги още използват пътища под `OLD_ROOT`: контейнерът за документацията монтира билднатия сайт и Nginx конфигурация; Grafana монтира dashboard-и и provisioning от backend хранилището. Работната директория на backend Compose също сочи там. Други mounts, например за MQTT и публичното proxy, сочат към `RUNTIME_ROOT`. Ако старият корен стане само онлайн, Drive бъде спрян или папката бъде изтрита **преди** смяна и проверка на тези зависимости, живият сайт може да спре въпреки новите Git копия.

### Контролирана последователност

1. **Избор на цел и начален опис.** Одобри `NEW_ROOT` извън Google Drive и провери свободното място. Запиши клон/SHA/промени за четирите активни хранилища и прегледай отделно седемте копия с промени. Запиши активните Compose overlays, ефективните mounts, имената на volumes и проверките за здраве. Потвърди архивите и възстановяването, без да показваш тайни.
2. **Чисти копия на кода.** Клонирай прегледания `main` на всяко хранилище в отделна папка под `NEW_ROOT`. Сравни SHA и провери за чист статус. Не копирай `node_modules`, build, Docker volumes, `RUNTIME_ROOT` или всички стари копия. Инсталирай от lockfile (`npm ci`) само за портал/документация, ако реално ще ги билдваш. Старите копия и живите контейнери остават непокътнати.
3. **Пренасочване на инструментите.** Промени запазените проекти в Codex към новите папки, избери правилната основна папка и провери че инструкциите/работната директория се зареждат оттам. Старите задачи може да помнят предишния път; отвори нова задача в новия проект за проверка. Git е източникът на истина за кода, не Drive.
4. **Отделно одобрено превключване на работещите услуги.** Билдни docs на новото място и смени двата му bind mount-а. Смени mounts на Grafana и работния път/извикване на backend Compose. Преди промяна провери ефективната Compose конфигурация. В прозорец за поддръжка пресъздай само засегнатите контейнери; никога не изтривай volumes или използвай `down -v`. Единният частен backend `.env` и външните MQTT/proxy mounts остават на място. Проверявай след всяка стъпка.
5. **Приемане или връщане.** Провери BG/EN docs и ресурсите им, Grafana, портала/API/auth, MQTT/heartbeat и постоянството на базите. Провери, че новите mounts сочат към `NEW_ROOT` и никоя работеща услуга не зависи от `OLD_ROOT`. При грешка върни старите bind пътища/Compose извикване и пресъздай само засегнатите контейнери; пази volumes и стария код. Запиши резултатите в [HANDOFF.md](../HANDOFF.md). Едва след приемане и отделно одобрение архивирай или премахвай излишни копия. Не прави масово изтриване на седемте копия с промени, непубликуваните файлове или частния runtime.

### Google Drive след превключването

Архивно копие може да остане в Drive, но не като активна папка за код и build. Режимът **Stream files** пази файловете основно в облака и ги изтегля/кешира при отваряне; не означава нула локални копия или нулева синхронизация. **Mirror files** пази пълно локално копие. Преди смяна на режима провери, че качването е приключило, и не трий папката само защото я виждаш във Finder. Едва когато контейнерите вече не използват `OLD_ROOT`, а Codex сочи към `NEW_ROOT`, избери режим „само онлайн“ за архива. Виж [упътването на Google за Stream/Mirror](https://support.google.com/drive/answer/13401938).

### Условия за приключване

- Четири чисти, възпроизводими Git копия на одобрения локален път; всички важни локални промени/файлове са отчетени.
- Нито активна услуга, нито проект в Codex използва кода в Drive; старото копие остава възстановимо по време на прехода.
- В Git не са пренесени тайни, клиентски данни, сертификати, volumes или настройки на Edge и нищо от тях не е изтрито.
- Docs, Grafana, портал, вход, API, MQTT и данните минават описаните проверки след превключването; връщането е проверено.
- Едва тогава обмисли спиране на синхронизацията на архива. **Този документ не твърди, че някое от условията вече е изпълнено.**
