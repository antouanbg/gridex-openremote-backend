# GrideX implementation documentation

## English

The canonical network and deployment architecture is **GrideX v4**. It supersedes the v1/v2/v3 network decisions that placed WireGuard on ROCK Pi or allowed public MQTT access.

- [Canonical v4 package (Bulgarian)](v4/README_BG.md)
- [Backend deployment plan](v4/GrideX_Backend_Deployment_Plan_BG_v4.md)
- [Windows 11 runbook](v4/GrideX_Windows11_Runbook_BG_v4.md)
- [Site router runbook](v4/GrideX_Site_Router_Runbook_BG_v4.md)
- [Security and service review](v4/GrideX_Security_Service_Review_BG_v4.md)
- [Acceptance tests](v4/GrideX_Acceptance_Tests_BG_v4.md)
- [Bulgarian network diagram](v4/diagrams/GrideX_Network_v4.png)
- [English network diagram](diagrams/GrideX_Network_v4_EN.svg)

The files under `v4/` are copied byte-for-byte from the verified handoff package and are covered by its `SHA256SUMS.txt`. The English diagram is a translated companion outside that checksum-controlled package.

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
- [Мрежова схема на английски](diagrams/GrideX_Network_v4_EN.svg)

Файловете в `v4/` са копирани byte-for-byte от проверения handoff пакет и са обхванати от неговия `SHA256SUMS.txt`. Английската схема е отделен превод извън пакета с контролни суми.

Тази документация не удостоверява внедрена система. Всичките 95 runtime приемателни теста остават `NOT_RUN`. Реални адреси, VPN диапазони, ключове, credentials, inventory и deployment домейни трябва да останат извън Git.
