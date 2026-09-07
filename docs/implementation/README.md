# GrideX implementation documentation

## English

The canonical network and deployment architecture is **GrideX v4**. It supersedes the v1/v2/v3 network decisions that placed WireGuard on ROCK Pi or allowed public MQTT access.

- [Complete English v4 companion package](v4-en/README_EN.md)
- [Backend deployment plan — EN](v4-en/GrideX_Backend_Deployment_Plan_EN_v4.md)
- [Windows 11 runbook — EN](v4-en/GrideX_Windows11_Runbook_EN_v4.md)
- [Site router runbook — EN](v4-en/GrideX_Site_Router_Runbook_EN_v4.md)
- [Security and service review — EN](v4-en/GrideX_Security_Service_Review_EN_v4.md)
- [Acceptance tests — EN](v4-en/GrideX_Acceptance_Tests_EN_v4.md)
- [Codex publication procedure — EN](v4-en/CODEX_UPLOAD_V4_EN.md)
- [Bulgarian network diagram](v4/diagrams/GrideX_Network_v4.png)
- [English network diagram](v4-en/diagrams/GrideX_Network_v4_EN.svg)
- [Canonical v4 package (Bulgarian)](v4/README_BG.md)

The files under `v4/` are copied byte-for-byte from the verified handoff package and are covered by its `SHA256SUMS.txt`. The complete English translation under `v4-en/`, including its diagram, is a companion outside that checksum-controlled package. The Bulgarian package remains the source of truth if a translation differs.

This documentation does not represent a deployed system. All 95 runtime acceptance tests remain `NOT_RUN`. Real addresses, VPN ranges, keys, credentials, inventories and deployment hostnames must remain outside Git.

---

## Български

Каноничната мрежова и deployment архитектура е **GrideX v4**. Тя отменя мрежовите решения от v1/v2/v3 с WireGuard върху ROCK Pi или публичен MQTT достъп.

- [Каноничен пакет v4](v4/README_BG.md)
- [План за backend внедряване](v4/GrideX_Backend_Deployment_Plan_BG_v4.md)
- [Windows 11 runbook](v4/GrideX_Windows11_Runbook_BG_v4.md)
- [Runbook за рутер на обект](v4/GrideX_Site_Router_Runbook_BG_v4.md)
- [Преглед на сигурността и услугите](v4/GrideX_Security_Service_Review_BG_v4.md)
- [Приемателни тестове](v4/GrideX_Acceptance_Tests_BG_v4.md)
- [Мрежова схема на български](v4/diagrams/GrideX_Network_v4.png)
- [Мрежова схема на английски](v4-en/diagrams/GrideX_Network_v4_EN.svg)
- [Пълен английски companion пакет](v4-en/README_EN.md)

Файловете в `v4/` са копирани byte-for-byte от проверения handoff пакет и са обхванати от неговия `SHA256SUMS.txt`. Пълният английски превод в `v4-en/`, включително схемата, е отделен companion пакет извън контролните суми. При разлика българският пакет остава source of truth.

Тази документация не удостоверява внедрена система. Всичките 95 runtime приемателни теста остават `NOT_RUN`. Реални адреси, VPN диапазони, ключове, credentials, inventory и deployment домейни трябва да останат извън Git.
