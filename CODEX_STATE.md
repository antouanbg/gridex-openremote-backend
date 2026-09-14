# CODEX_STATE.md

## Active checkpoint — 2026-09-14 / Активно състояние

Current task: Mac/Linux compatibility research and durable handoff. Owner stopped
Windows experiments. Baseline origin/main 279745b; branch docs/macos-linux-handoff.
Completed: host inspection, registry ARM64 checks, Colima/CLI/Compose version
research, EN/BG docs and handoff. Modified: AGENTS.md, HANDOFF.md, CODEX_STATE.md,
README.md, docs/MAC_LINUX_HANDOFF.md. Validation: documentation diff and secret/
identifier review; no runtime tests. No software installed, no VM/containers
started. 0/6 implementation milestones complete. Known issues: OIDC token
endpoint, migration execution, staging override and all runtime/restore checks
pending. Next: install/verify Colima gridex ARM64 profile and implement isolated
staging in the next task; preserve the recovery backlog below.

Текущо: проучване за Mac/Linux и траен handoff. Windows експериментите са спрени.
Основа origin/main 279745b; branch docs/macos-linux-handoff. Готови: host проверка,
ARM64 metadata, Colima/CLI/Compose версии, EN/BG документация. Променени: AGENTS.md,
HANDOFF.md, CODEX_STATE.md, README.md, docs/MAC_LINUX_HANDOFF.md. Проверки: diff и
преглед за secrets/идентификатори; без runtime тестове. Няма инсталации или старт
на VM/контейнери. 0/6 implementation етапа готови. Остават OIDC token endpoint,
миграции, staging override, runtime/restore проверки. Следва: Colima gridex ARM64
профил и изолиран staging в следващата задача; recovery backlog по-долу се запазва.

## Previous recovery checkpoint / Предходно recovery състояние

## Current task

Document the planned recovery ingestion of the ROCK Pi local telemetry journal.
No recovery-worker source code is implemented by this task.

Документирай планирания recovery ingestion на local telemetry journal-а на ROCK
Pi. С тази задача не се имплементира source code за recovery worker.

## Completed

- Added the durable, repository-specific handoff entry for the coordinated Edge
  export and backend recovery-ingestion work.

- Добавен е трайният, специфичен за repository-то handoff запис за
  координираните Edge export и backend recovery-ingestion задачи.

## Remaining

- Agree the versioned export/acknowledgement contract with the Edge repository.
- Implement the idempotent PostgreSQL ingestion worker in a separate Pull
  Request, then prove recovery without any control command.

- Договори versioned export/acknowledgement договора с Edge repository-то.
- Имплементирай idempotent PostgreSQL ingestion worker в отделен Pull Request,
  после докажи recovery без control команда.

## Modified files

- `HANDOFF.md`
- `CODEX_STATE.md`
- `docs/integration-flow.md`
- `docs/TELEMETRY_JOURNAL_RECOVERY_V1.md`

## Tests

- Documentation-only change; `git diff --check` passed.

## Known issues

- No export, acknowledgement, replay or backend recovery worker exists yet.

## Next action

Create the coordinated Edge and backend implementation Pull Requests only after
the versioned record identity and acknowledgement contract are approved.

Създай координираните Edge и backend implementation Pull Request-и едва след
одобрение на versioned record identity и acknowledgement договора.

## Last updated

2026-09-13
