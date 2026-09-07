# GrideX — implementation package v4.0: VPN on site routers

Date: 6 September 2026
Status: architecture documentation and templates; **not a deployed configuration**.

## Accepted change

Every site has a dedicated EMS router that separates the EMS environment from the Internet and the customer's LAN, terminates WireGuard, and holds the site's unique VPN key. Windows 11 remains the central WireGuard peer as a native system service. ROCK Pi and ESP32 do not run WireGuard. Modbus and MQTTS use the shared tunnel of the corresponding site router.

Version 4 supersedes the v3 decisions that placed WireGuard on ROCK Pi and allowed a direct public MQTTS channel. It retains the requirements for independent local safety, authentication, separate databases, protected command transactions, and acceptance testing before real control is enabled.

## Contents and reading order

1. [Implementation plan v4](GrideX_Backend_Deployment_Plan_EN_v4.md).
2. [Windows 11 deployment runbook](GrideX_Windows11_Runbook_EN_v4.md).
3. [Per-site router deployment runbook](GrideX_Site_Router_Runbook_EN_v4.md).
4. [Security and service-completeness review](GrideX_Security_Service_Review_EN_v4.md).
5. [Acceptance tests](GrideX_Acceptance_Tests_EN_v4.md).
6. [Local Codex task: commit, push and draft PR](CODEX_UPLOAD_V4_EN.md).
7. [English network diagram](diagrams/GrideX_Network_v4_EN.svg) and its [explanation](diagrams/README_EN.md).
8. [Sources and review boundaries](SOURCES_EN.md).
9. [Changes from v3](CHANGELOG_EN.md).

The canonical configuration examples remain in [`../v4/templates/`](../v4/templates/). They are templates only and are not ready for direct import. Their placeholder values are intentionally invalid for a real network. Router-specific commands depend on the selected model, firmware, and verified capabilities.

The language-neutral artifacts remain in the canonical package and are not duplicated: [`SHA256SUMS.txt`](../v4/SHA256SUMS.txt), [`DOCUMENT_VALIDATION.json`](../v4/DOCUMENT_VALIDATION.json), the already-English `.example` templates, and the already-English read-only verifier source.

The canonical BG package verifier remains at [`../v4/tools/verify_package.py`](../v4/tools/verify_package.py). It checks the manifest, structure, JSON, relative Markdown links, and a limited set of sensitive-data indicators. It is not an exhaustive secret scanner, antivirus product, or network audit, and it does not perform OCR on images.

## Confidentiality and publication

No real deployment addresses, customer data, VPN keys, or passwords belong in this repository. Actual inventory, router exports, WireGuard configurations, logs, and backups must remain outside Git, the package directory, and Docker build contexts.

Do not upload old v1/v2/v3 archives, operator copies, or previous diagrams containing unsuitable components or example deployment addresses. Documentation publication and real deployment are separate tasks.

## Verified and unverified items

The canonical BG package integrity is verified against its manifest. Historical source-code findings are retained as a baseline, not presented as a new audit of current `main`. All runtime, VPN, router, Docker, and hardware tests remain `NOT_RUN`. This documentation does not claim the absence of vulnerabilities and does not authorize real power dispatch.
