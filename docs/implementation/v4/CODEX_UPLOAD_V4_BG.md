# Задача за локалния Codex — качване на GrideX v4 чрез draft PR

**Само документационна публикация. Не изпълнявай runbook/инсталационните стъпки.**

Изходна папка: директорията `GrideX_Implementation_v4`, получена от ZIP пакета.
Пример Windows: `C:\GrideX-Handoff\v4\GrideX_Implementation_v4`.
При WSL използвай съответния `/mnt/c/...` път.
Изходната папка е извън Git repository и build context.

Целево хранилище: `antouanbg/gridex-openremote-backend`.
Цел в него: `docs/implementation/v4/`.
Нов клон: `docs/implementation-v4-site-router-vpn` (или свободно уникално име).
Основа/PR base: актуалният `origin/main`.

## Разрешен резултат

Подготви и публикувай само проверената документация, шаблони, схема и
проверяващ инструмент от пакета. Създай commit, push на отделен клон и draft PR.
Не merge-вай и не включвай auto-merge.

Няма разрешение за real deployment, инсталация, рестарт, промяна на
Windows/router/WireGuard/Docker/Edge или управление на BESS.
Не генерирай/чети частни ключове и не попълвай placeholders с реални данни.
Не качвай v1/v2/v3 архиви, patch-ове, старите генерирани изображения,
операторски копия или целия ZIP.

Публичният branch/draft PR също е публичен. Реални мрежови адреси,
разположения, credentials, device inventory и captures не се публикуват.

## 1. Repository и права

Прочети приложимите AGENTS.md. Провери cwd, origin, текущ клон и незавършена
работа. Origin трябва да е точно целевото хранилище. Не показвай embedded
credentials от remote URL и не променяй origin/видимост/права.

Провери Git/GitHub CLI authentication в същата среда Windows/WSL.
При липсващ login операторът изпълнява:
`gh auth login --hostname github.com --web`.
Не извеждай token, не използвай --show-token или gh auth token.
При отказ за достъп спри и отчети; не заобикаляй разрешенията.

Не използвай reset --hard, clean -fd, автоматичен stash или force push.
Получѝ актуалния origin/main и предпочети чист отделен Git worktree от него.
Запиши base SHA. Провери съществуващи клонове/PR-и за задачата; не дублирай,
не презаписвай чужда работа и не превключвай мълчаливо основния workspace.

## 2. Проверка на входния пакет

Прочети README_BG.md, CHANGELOG_BG.md, настоящия файл и source на
tools/verify_package.py. Последният трябва да прави само локално четене,
checksums/структурни проверки и отчет — без network/system modifications.

След проверката на source изпълни в изходната директория:
`python tools/verify_package.py`.
Използвай наличния python/python3/py според средата. Не инсталирай
зависимости: инструментът използва само Python стандартната библиотека.

Изисквай успешни SHA256SUMS и file-set проверки. Checksums доказват
цялост спрямо предоставения manifest, не цифрово подписан произход.
При mismatch/неочакван файл/symlink/опасен path спри преди commit.

Провери PNG визуално: само placeholders, HAProxy, две отделни PostgreSQL,
WireGuard на Windows и routers; няма VPN на ROCK Pi и няма public MQTT.
Не заменяй схемата с по-стари изображения от разговора.

## 3. Файлове за копиране

Копирай точно файловете от SHA256SUMS.txt плюс самия SHA256SUMS.txt
в `docs/implementation/v4/`, запазвайки имена, поддиректории и bytes.

Не изпълнявай templates или runbooks. При вече съществуваща различна v4
сравни съдържанието и спри при неясен конфликт; не презаписвай автоматично.

Разрешени допълнения извън пакетната папка:
- кратък index/link update в `docs/implementation/README.md`;
- кратка връзка към v4 в кореновия `README.md`, запазвайки двуезичието;
- подходящи липсващи правила в `.gitignore`, след съдържателен преглед;
- при необходимост scoped `.gitattributes` правило за byte preservation.

В индексите обозначи:
v4 заменя само старите мрежови решения за WG на ROCK Pi, директния публичен
ESP MQTT и старите AllowedIPs. Останалите control/security blockers не се
затварят чрез документационния PR. Запазените стари версии са исторически.

За точни checksums при Windows core.autocrlf прегледай `.gitattributes`.
Без глобална промяна на Git настройките при нужда добави само:
`docs/implementation/v4/** -text`
Това запазва bytes на пакетните текстове при checkout. Провери конфликтни
по-специфични attributes. Не променяй кодови файлове, Compose или workflows.

Не мести реалните `.example` шаблони в директории за активни конфигурации.
Не обновявай други хранилища в тази задача.

## 4. Поверителност и точност

Провери всички нови/променени текстове, изображения, JSON, metadata, diff,
commit messages и бъдещото PR описание за:
- реални public/LAN/VPN/OT IP адреси, CIDR и deployment DNS имена;
- private keys, tokens, пароли, QR configs, DPAPI/working конфигурации;
- реални public keys/fingerprints, peer/site/device инвентар;
- клиентски данни, реални лични filesystem paths, logs и captures.

Публичните официални documentation и source repository URLs са допустими,
освен ако съдържат credentials. Placeholder текстът е умишлен и се запазва.
Не добавяй реални адреси от разговора или машината.

Ползвай наличен локален secret scanner, ако има, плюс съдържателна проверка.
Не качвай файловете във външен scanner. При съмнение докладвай само файл,
ред/поле и категория; не самата sensitive стойност. Спри преди push.

Провери относителни Markdown връзки и JSON; `verify_package.py` се изпълнява
отново и в целевата v4 папка. SOURCE/code findings са исторически и runtime
тестовете остават NOT_RUN, освен ако има отделно реално доказателство.
Не представяй документационни checks като runtime PASS.

Прегледай `.github/workflows` преди push/PR. При опасност push/PR да пусне
deployment/privileged runtime job спри и докладвай, без workflow промени.
Не създавай публични issues с допълнителна конфигурационна информация.

## 5. Commit, push, draft PR

Stage-вай само конкретните разрешени paths. Не използвай git add . / -A.
Прегледай staged diff, binary files и `git diff --cached --check`.
Провери и всички commits спрямо base SHA: няма непроверени междинни версии,
чужди промени или secrets. Не публикувай main, други branches или tags.

Commit message:
`docs: add v4 site-router WireGuard deployment package`

Push само новия branch. Създай draft PR със:
base `main`, head реалния нов клон,
title `docs: GrideX v4 site-router VPN implementation plan`.

PR body:
- какво е добавено;
- Windows native WG service + per-site router peers;
- ROCK Pi/ESP32 без VPN; Modbus + MQTTS през routed site tunnel;
- уникални site prefixes, без SNAT/OT routes/site transit;
- VPN-only TCP 8883, без public fallback;
- постоянни машинни ключове + trusted enrollment/revoke;
- исторически blockers, нови router рискове и 95 NOT_RUN runtime теста;
- точните извършени документни проверки;
- no deployment, no secrets, no hardware tests.

Използвай `gh pr create --draft` с изрични repository/base/head/title/body-file.
Не включвай локални private logs. Не merge-вай и не включвай auto-merge.
При push/PR failure запази локалната работа и отчети точния неуспешен етап.

## 6. Финален отчет

Посочи repository, base SHA, branch, нов commit SHA, променени files,
извършени checks, резултат от push и URL на реално създадения PR.
Покажи workflow checks като чакащи/успешни/неуспешни, не предполагай резултат.

Изрично отбележи, че main не е променен, няма внедряване и placeholders
не са заменени с реални адреси/ключове. „Готови файлове“ не е успешен push.

Източници за CLI: S6–S7 в SOURCES.md.
